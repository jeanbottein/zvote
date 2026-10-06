# zvote performance: JVM, Leyden and GraalVM

Measured on 2026-09-27. The question: how should the server run once it is
deployed (roadmap phase 6)? On the regular JVM, with OpenJDK's new AOT cache
(Project Leyden), on Oracle GraalVM's JIT, or as a GraalVM native image, with or
without profile-guided optimization?

**In short.** A native image built with profile-guided optimization (PGO)
starts in 0.13 s instead of 3.7 s, uses a third of the memory at rest and less
than half under load, handles as many ballots as the JVM at its best, from the
first second, and burns the least CPU per ballot. What it costs: 40 minutes of
builds on this machine, and native-only bugs that only a native test run finds.
On the JVM, Leyden's AOT cache with Spring's AOT processing gets startup to
1.1 s for a few seconds of build and no constraints at all. GraalVM's JIT
brought nothing on this workload.

## How it was measured

- **Machine**: Apple M1, 8 cores, 8 GB, macOS 26.6. Not a quiet machine: other
  applications kept the load average between 8 and 15 and memory in swap. Each
  variant was measured twice, in two sweeps run in opposite orders; both are
  shown. Differences within a few percent are noise.
- **Software**: zvote on the `perf/native-image` branch, Spring Boot 4.1.1, H2
  in file mode. Temurin 25.0.4 and Oracle GraalVM 25.0.4. On macOS, native
  images only have the Serial garbage collector (G1 is Linux-only).
- **Startup**: from launching the process to the first answer from
  `/actuator/health`, polled every 5 ms: the median of 5 restarts on an
  existing database. (The very first launch of a freshly built native
  executable took 0.5 to 2.8 s: macOS checks a new binary once.) **Memory**: the process's resident size, 1 s after
  startup and after the workload.
- **Workload** (`servers/java/perf/Load.java`): 200 viewers follow a majority
  judgment poll live while 3,000 new voters each cast a ballot on its 5
  options, 32 at a time. Five rounds on a running server; the first is
  "cold", the median of the other four "warm". **Fan-out**: from the last
  ballot's answer to every viewer showing the final count. **CPU**: ballots
  per second of the server's CPU time, over all five rounds.

## Results (sweep 1 / sweep 2)

| Variant | Startup | Memory at rest | Memory under load | Ballots/s, cold | Ballots/s, warm | p50 / p99 (ms) | Ballots per CPU-second |
|---|---|---|---|---|---|---|---|
| JVM (Temurin, C2) | 3.74 / 3.66 s | 318 / 319 MB | 607 / 568 MB | 283 / 276 | 467 / 452 | 57–59 / 265–268 | 69 / 69 |
| JVM, compact object headers | 4.12 / 3.64 s | 319 / 319 MB | 574 / 565 MB | 218 / 291 | 444 / 471 | 55–60 / 259–262 | 66 / 69 |
| JVM + Leyden AOT cache | 1.49 / 1.48 s | 308 / 308 MB | 559 / 590 MB | 322 / 314 | 506 / 504 | 51–52 / 228–232 | 74 / 73 |
| JVM + Leyden + Spring AOT | 1.10 / 1.09 s | 293 / 303 MB | 548 / 453 MB | 309 / 303 | 518 / 462 | 51–56 / 218–251 | 72 / 72 |
| Oracle GraalVM JIT | 4.30 / 4.19 s | 297 / 297 MB | 555 / 551 MB | 288 / 269 | 396 / 407 | 65–66 / 275–298 | 63 / 60 |
| Native image | 0.17 / 0.16 s | 131 / 131 MB | 261 / 255 MB | 335 / 345 | 355 / 344 | 74–77 / 334–335 | 58 / 59 |
| **Native image, PGO** | **0.14 / 0.13 s** | **99 / 99 MB** | 273 / 261 MB | **487 / 489** | 489 / 477 | 53–54 / 248–249 | **83 / 85** |

No ballot failed in any run, and every viewer always ended with the right count.
Fan-out took between 52 and 181 ms for every variant: it is governed by the
stream's 200 ms coalescing window, not by the runtime.

| Build | Time on this machine | Artifact |
|---|---|---|
| Jar | 8 s | 28 MB, plus a Java 25 runtime (294 MB for Temurin's JDK) |
| Leyden AOT cache (training run) | about 35 s | about 95 MB cache beside the jar |
| Native image | 9.5–10 min | 117 MB executable, nothing else |
| Native image, PGO | 33 min instrumented + 7 min optimized | 90 MB executable |

## What the numbers say

1. **Startup is where native images win, by far**: 22 to 28 times faster than
   the JVM. Leyden closes part of the gap without leaving the JVM: 2.5 times
   faster with its cache alone, 3.4 times with Spring's AOT processing added.
2. **Memory**: a native image needs a third of the JVM's memory at rest and
   less than half under load. Compact object headers (a Java 25 flag) changed
   nothing measurable here: resident memory follows how much heap the JVM
   reserves, not how small its objects are.
3. **Throughput**: a plain native image stays around 350 ballots/s, 25% under
   a warmed-up JVM, because it has no JIT to learn the hot paths. PGO gives it
   that knowledge ahead of time, and matches the JVM at its best from the very
   first round, when the JVM is still at 280. Leyden's cache also warms the JVM
   up a little sooner (its training run records method profiles).
4. **CPU per ballot**: the PGO image uses the least, the plain native image the
   most. The JVM's own figure includes the JIT compiling as the load arrives.
5. **GraalVM's JIT did not help** this workload: slower to start and about 12%
   below C2 once warm. Its rounds were still climbing at the end of the run, so
   a longer run might tell otherwise; this workload spends its time in the
   database and on sockets, where a better compiler has little to optimize.
6. **The ceiling is the database, not the runtime.** Ballots on one poll queue
   on H2's row lock (H2 has no `FOR SHARE`), which caps a poll at about 500
   ballots/s here. On PostgreSQL, ballots do not wait for each other, and the
   differences between runtimes would count for more.

## What it means for zvote

For deployment (phase 6), in order of effort:

- **Now, for free**: run the JVM with a Leyden AOT cache and Spring AOT, built
  in the image by a training run. 1.1 s startups, the JIT's full speed, no
  constraint on the code.
- **For small or scale-to-zero instances**: a native image with PGO. It starts
  in a tenth of a second on a hundred megabytes, and serves as much as the JVM.
  Plan for it: CI builds on Linux with plenty of memory (this 8 GB machine was
  swapping), `-PnativeTest` in CI (see below), and Oracle GraalVM for PGO (free
  to use, not open source). GraalVM Community Edition has no PGO, nor the
  machine-learned profiles Oracle GraalVM applies by default ("PGO:
  ML-inferred" in the build output, which the plain native image above had):
  expect at least its 25% gap to the JVM under load.
- Numbers for decisions should come from the target: Linux, with G1 in the
  native image, on PostgreSQL. This page is a first map, not the verdict.

## Making it work natively

H2 in file mode, Flyway and Spring Data JDBC all work in a native image: the
roadmap's worry about H2 did not hold. Two bugs had to be fixed first, both
invisible on the JVM:

- **Reading timestamps** failed: H2 returns `OffsetDateTime`, the entities hold
  `Instant`, and Spring converted between them by finding `toInstant()` through
  reflection at run time, which native images do not allow.
  `PersistenceConfiguration` now declares that converter outright.
- **The live stream** failed to serialize its updates: `PollUpdate` never
  appears in a controller's signature, so Spring's AOT processing did not know
  to keep it. `@RegisterReflectionForBinding(PollUpdate.class)` on the stream's
  endpoint says so.

Flyway warns at startup that it cannot scan `db/migration` in a native image;
Spring Boot's own resource provider finds the scripts anyway.

With both fixes, the whole test suite also passes as a native image
(`./mvnw -PnativeTest test`: a 13-minute build here, an 8-second run): 70 of
the 75 tests, including the HTTP contract and the live stream over a real
socket. The other 5 are JVM-only by nature, and marked
`@DisabledInNativeImage`: the architecture rules read class files, and one
test mocks with Mockito, which generates classes at run time.

## Reproducing

With a Java 25 JDK in `JAVA_HOME` and Oracle GraalVM 25 in `GRAALVM_HOME`
(`sdk install java 25.0.4-tem`; GraalVM from oracle.com if SDKMAN has no build
for your platform):

```bash
cd servers/java
./mvnw -Pnative native:compile        # the native image alone: target/zvote-server
./mvnw -PnativeTest test              # the test suite, compiled and run as a native image
perf/bench.py prepare [--pgo]         # every variant, under target/perf (long: native builds)
perf/bench.py run                     # measures them all; results in target/perf/results.jsonl
```

Close other applications first, and run it twice: numbers from one run on a
busy machine are not worth much.
