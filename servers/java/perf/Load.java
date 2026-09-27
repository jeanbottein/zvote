import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Pattern;

/**
 * One zvote workload: V live viewers on a poll, B ballots from B new voters,
 * C in flight at a time. Prints one JSON line per round.
 *
 *   java Load.java http://127.0.0.1:18080 <viewers> <ballots> <concurrency> <rounds>
 */
public class Load {

    static final SecureRandom RANDOM = new SecureRandom();
    static final String[] MENTIONS = {"Excellent", "VeryGood", "Good", "Fair", "Passable", "Inadequate", "Bad"};
    static final Pattern TOTAL = Pattern.compile("\"totalBallots\":(\\d+)");
    static final Pattern OPTION_ID = Pattern.compile("\"id\":\"(\\d+)\"");

    public static void main(String[] args) throws Exception {
        var base = args[0];
        int viewers = Integer.parseInt(args[1]), ballots = Integer.parseInt(args[2]);
        int concurrency = Integer.parseInt(args[3]), rounds = Integer.parseInt(args[4]);
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var http = HttpClient.newBuilder().executor(executor).connectTimeout(Duration.ofSeconds(5)).build();
            for (int round = 1; round <= rounds; round++) {
                System.out.println(round(http, base, viewers, ballots, concurrency, round));
            }
        }
    }

    static String round(HttpClient http, String base, int viewerCount, int ballots, int concurrency, int round)
        throws Exception {
        var created = http.send(request(base + "/api/polls", newVoter())
                .POST(HttpRequest.BodyPublishers.ofString("""
                    {"title":"Load","options":["A","B","C","D","E"],"votingSystem":"MAJORITY_JUDGMENT","visibility":"UNLISTED"}
                    """)).build(),
            HttpResponse.BodyHandlers.ofString()).body();
        var poll = created.replaceAll(".*\"id\":\"([^\"]+)\",\"title\".*", "$1");
        var options = OPTION_ID.matcher(created).results().map(m -> m.group(1)).toList();

        // The viewers: each follows the stream and notes when it first sees the final count.
        var connected = new CountDownLatch(viewerCount);
        var done = new CountDownLatch(viewerCount);
        var updates = new AtomicLong();
        var seenAt = new ConcurrentLinkedQueue<Long>();
        var streams = new ArrayList<java.util.stream.Stream<String>>();
        for (int v = 0; v < viewerCount; v++) {
            var response = http.send(request(base + "/api/polls/" + poll + "/events", newVoter())
                .header("Accept", "text/event-stream").GET().build(), HttpResponse.BodyHandlers.ofLines());
            var lines = response.body();
            synchronized (streams) {
                streams.add(lines);
            }
            Thread.ofVirtual().start(() -> {
                var first = true;
                try {
                    for (var line : (Iterable<String>) lines::iterator) {
                        var total = TOTAL.matcher(line);
                        if (!total.find()) {
                            continue;
                        }
                        if (first) {
                            first = false;
                            connected.countDown();
                        } else {
                            updates.incrementAndGet();
                        }
                        if (Integer.parseInt(total.group(1)) == ballots) {
                            seenAt.add(System.nanoTime());
                            done.countDown();
                        }
                    }
                } catch (RuntimeException closed) {
                    // the stream was closed at the end of the round
                }
            });
        }
        if (!connected.await(30, TimeUnit.SECONDS)) {
            throw new IllegalStateException("viewers did not connect");
        }

        // The ballots.
        var gate = new Semaphore(concurrency);
        var latencies = new long[ballots];
        var errors = new AtomicInteger();
        var index = new AtomicInteger();
        var start = System.nanoTime();
        var voters = new ArrayList<Thread>(ballots);
        for (int b = 0; b < ballots; b++) {
            gate.acquire();
            voters.add(Thread.ofVirtual().start(() -> {
                try {
                    var body = new StringBuilder("{\"judgments\":{");
                    for (int o = 0; o < options.size(); o++) {
                        body.append(o == 0 ? "" : ",").append('"').append(options.get(o)).append("\":\"")
                            .append(MENTIONS[RANDOM.nextInt(MENTIONS.length)]).append('"');
                    }
                    body.append("}}");
                    var t0 = System.nanoTime();
                    var status = http.send(request(base + "/api/polls/" + poll + "/ballot", newVoter())
                            .PUT(HttpRequest.BodyPublishers.ofString(body.toString())).build(),
                        HttpResponse.BodyHandlers.discarding()).statusCode();
                    latencies[index.getAndIncrement()] = System.nanoTime() - t0;
                    if (status != 200) {
                        errors.incrementAndGet();
                    }
                } catch (Exception e) {
                    errors.incrementAndGet();
                } finally {
                    gate.release();
                }
            }));
        }
        for (var voter : voters) {
            voter.join();
        }
        var end = System.nanoTime();
        var allSeen = done.await(30, TimeUnit.SECONDS);
        var lastSeen = seenAt.stream().mapToLong(Long::longValue).max().orElse(end);
        synchronized (streams) {
            streams.forEach(java.util.stream.Stream::close);
        }

        var sorted = Arrays.copyOf(latencies, index.get());
        Arrays.sort(sorted);
        return String.format(Locale.ROOT,
            "{\"round\":%d,\"ballots\":%d,\"viewers\":%d,\"concurrency\":%d,\"seconds\":%.3f,\"ballotsPerSecond\":%.0f,"
                + "\"p50ms\":%.2f,\"p95ms\":%.2f,\"p99ms\":%.2f,\"maxms\":%.2f,\"errors\":%d,"
                + "\"allViewersUpToDate\":%s,\"fanOutMs\":%.0f,\"updatesPerViewer\":%.1f}",
            round, ballots, viewerCount, concurrency, (end - start) / 1e9, ballots / ((end - start) / 1e9),
            percentile(sorted, 50), percentile(sorted, 95), percentile(sorted, 99), percentile(sorted, 100),
            errors.get(), allSeen, (lastSeen - end) / 1e6, updates.get() / (double) viewerCount);
    }

    static double percentile(long[] sorted, int p) {
        if (sorted.length == 0) {
            return 0;
        }
        var i = Math.min(sorted.length - 1, (int) Math.ceil(p / 100.0 * sorted.length) - 1);
        return sorted[Math.max(i, 0)] / 1e6;
    }

    static HttpRequest.Builder request(String url, String voter) {
        return HttpRequest.newBuilder(URI.create(url))
            .header("Content-Type", "application/json")
            .header("Cookie", "zvote_voter=" + voter)
            .timeout(Duration.ofSeconds(30));
    }

    static String newVoter() {
        var bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
