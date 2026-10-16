package org.supervote.server.statistics;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.supervote.server.identity.VoterIdentity;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the statistics count, where, and when they show, for super-vote and for
 * each poll. Other tests share the database, so these compare what changed.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StatisticsApiTest {

    @Autowired
    MockMvcTester mvc;

    @Autowired
    StatisticsService statistics;

    /** Whoever reads the statistics, always the same voter, so that reading them counts nobody new. */
    final Cookie reader = new Cookie(VoterIdentity.COOKIE, VoterIdentity.newToken());

    /** Starts from published counts: what other tests counted is written first. */
    @BeforeEach
    void publishWhatWasCounted() {
        statistics.flush();
    }

    @Test
    void countsPollsBallotsAndVotersWhereAndWhenTheyCame() {
        var before = published();
        var voters = List.of(new Browser("Asia/Tokyo"), new Browser("Asia/Tokyo"), new Browser("Asia/Tokyo"));

        var poll = voters.getFirst().createPoll();
        voters.forEach(voter -> voter.approve(poll, 0));
        voters.getFirst().approve(poll, 1); // a changed ballot is the same ballot
        statistics.flush();

        var after = published();
        assertThat(after.total("polls") - before.total("polls")).isEqualTo(1);
        assertThat(after.total("ballots") - before.total("ballots")).isEqualTo(3);
        assertThat(after.total("voters") - before.total("voters")).isEqualTo(3);
        assertThat(after.place("Asia/Tokyo", "polls") - before.place("Asia/Tokyo", "polls")).isEqualTo(1);
        assertThat(after.place("Asia/Tokyo", "ballots") - before.place("Asia/Tokyo", "ballots")).isEqualTo(3);
        assertThat(after.region("Asia", "voters") - before.region("Asia", "voters")).isEqualTo(3);
        assertThat(after.today("ballots") - before.today("ballots")).isEqualTo(3);
        assertThat(after.openPolls()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void aBallotWithdrawnThenCastAgainCountsTwice() {
        var voter = new Browser("Europe/Lisbon");
        var poll = voter.createPoll();
        var before = published();

        voter.approve(poll, 0);
        voter.withdraw(poll);
        voter.approve(poll, 0);
        statistics.flush();

        assertThat(published().total("ballots") - before.total("ballots")).isEqualTo(2);
    }

    @Test
    void aBallotRefusedCountsNowhere() {
        var voter = new Browser("Europe/Madrid");
        var poll = voter.createPoll();
        var before = published();

        var refused = voter.send(mvc.put().uri("/api/polls/" + JsonPath.<String>read(poll, "$.id") + "/ballot")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"approvedOptionIds\": [\"" + JsonPath.read(poll, "$.options[0].id") + "\"], "
                + "\"voterName\": \"Ana\"}")); // on a poll that shows no names, after the ballot is written
        statistics.flush();

        assertThat(refused).hasStatus(HttpStatus.BAD_REQUEST);
        assertThat(published().total("ballots")).isEqualTo(before.total("ballots"));
    }

    @Test
    void showsNothingNewUntilTheHourIsWritten() {
        var before = published();

        new Browser("Europe/Oslo").createPoll();

        assertThat(published().total("polls")).isEqualTo(before.total("polls"));
        statistics.flush();
        assertThat(published().total("polls")).isEqualTo(before.total("polls") + 1);
    }

    @Test
    void anUnknownTimeZoneCountsInTheTotalsOnly() {
        var before = published();

        for (int i = 0; i < StatisticsService.VISIBLE; i++) {
            new Browser("Mars/Olympus_Mons").createPoll();
            new Browser(null).createPoll();
        }
        statistics.flush();

        var after = published();
        assertThat(after.total("polls") - before.total("polls")).isEqualTo(2L * StatisticsService.VISIBLE);
        assertThat(after.list("places")).noneMatch(place -> place.get("timeZone").equals(StatisticsService.UNKNOWN));
        assertThat(after.list("regions")).noneMatch(region -> region.get("region").equals("Etc"));
    }

    @Test
    void aPlaceShowsOnceItCountsEnoughVoters() {
        var before = published();

        new Browser("Pacific/Pitcairn").createPoll();
        statistics.flush();

        assertThat(published().list("places")).noneMatch(place -> place.get("timeZone").equals("Pacific/Pitcairn"));
        assertThat(published().total("polls") - before.total("polls")).isEqualTo(1);

        for (int i = 1; i < StatisticsService.VISIBLE; i++) {
            new Browser("Pacific/Pitcairn").createPoll();
        }
        statistics.flush();

        assertThat(published().place("Pacific/Pitcairn", "voters")).isEqualTo(StatisticsService.VISIBLE);
    }

    @Test
    void aPollShowsWhereItsBallotsComeFromOnceItsResultsShow() {
        var creator = new Browser("Europe/Berlin");
        var poll = creator.createPoll("AFTER_CLOSING");
        for (var zone : List.of("Europe/Berlin", "Europe/Berlin", "Europe/Berlin", "America/Lima")) {
            new Browser(zone).approve(poll, 0);
        }
        statistics.flush();

        assertThat(creator.places(poll)).bodyJson().extractingPath("$.places").isNull();

        creator.close(poll);

        var places = creator.places(poll);
        assertThat(places).hasStatus(HttpStatus.OK).hasHeader(HttpHeaders.CACHE_CONTROL, "max-age=60");
        assertThat(places).bodyJson().extractingPath("$.places").isEqualTo(
            List.of(Map.of("timeZone", "Europe/Berlin", "ballots", 3)));
        assertThat(places).bodyJson().extractingPath("$.regions").isEqualTo(
            List.of(Map.of("region", "Europe", "ballots", 3)));
    }

    @Test
    void aWithdrawnBallotLeavesItsPlace() {
        var creator = new Browser("Africa/Nairobi");
        var poll = creator.createPoll("LIVE");
        var voters = List.of(new Browser("Africa/Nairobi"), new Browser("Africa/Nairobi"), new Browser("Africa/Nairobi"));
        voters.forEach(voter -> voter.approve(poll, 0));
        statistics.flush();
        assertThat(creator.places(poll)).bodyJson().extractingPath("$.places[0].ballots").isEqualTo(3);

        voters.getFirst().withdraw(poll);
        statistics.flush();

        assertThat(creator.places(poll)).bodyJson().extractingPath("$.places").isEqualTo(List.of());
    }

    @Test
    void aMintedVoterCounts() {
        var before = published();

        mvc.post().uri("/api/voters").header(StatisticsService.TIME_ZONE_HEADER, "America/Toronto").exchange();
        statistics.flush();

        assertThat(published().total("voters") - before.total("voters")).isEqualTo(1);
    }

    @Test
    void mayBeCachedForFiveMinutes() {
        assertThat(mvc.get().uri("/api/statistics").exchange())
            .hasStatus(HttpStatus.OK)
            .hasHeader(HttpHeaders.CACHE_CONTROL, "max-age=300, public");
    }

    /** Old names stand for today's; names of no place (UTC, CET) are unknown. */
    @ParameterizedTest
    @CsvSource({
        "Europe/Paris, Europe/Paris", "Asia/Calcutta, Asia/Kolkata", "US/Eastern, America/New_York",
        "Asia/Taipei, Asia/Taipei", "UTC, Etc/Unknown", "CET, Etc/Unknown", "Mars/Olympus_Mons, Etc/Unknown",
    })
    void findsThePlaceOfATimeZone(String timeZone, String place) {
        assertThat(StatisticsService.placeOf(timeZone)).isEqualTo(place);
    }

    @Test
    void noTimeZoneIsNoPlace() {
        assertThat(StatisticsService.placeOf(null)).isEqualTo(StatisticsService.UNKNOWN);
    }

    private Published published() {
        var body = mvc.get().uri("/api/statistics").cookie(reader).exchange().getResponse();
        try {
            return new Published(body.getContentAsString(StandardCharsets.UTF_8));
        } catch (java.io.UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    record Published(String json) {
        long total(String what) {
            return JsonPath.<Number>read(json, "$." + what).longValue();
        }

        long openPolls() {
            return total("openPolls");
        }

        List<Map<String, Object>> list(String which) {
            return JsonPath.read(json, "$." + which);
        }

        long place(String timeZone, String what) {
            return find("places", "timeZone", timeZone, what);
        }

        long region(String region, String what) {
            return find("regions", "region", region, what);
        }

        long today(String what) {
            return find("days", "day", LocalDate.now(ZoneOffset.UTC).toString(), what);
        }

        private long find(String which, String key, String value, String what) {
            return list(which).stream()
                .filter(row -> row.get(key).equals(value))
                .mapToLong(row -> ((Number) row.get(what)).longValue())
                .findFirst().orElse(0);
        }
    }

    /** A browser in a time zone, which gets its cookie on its first request. */
    class Browser {
        private final String timeZone;
        private Cookie cookie;

        Browser(String timeZone) {
            this.timeZone = timeZone;
        }

        String createPoll() {
            return createPoll("LIVE");
        }

        String createPoll(String resultsShown) {
            var result = send(mvc.post().uri("/api/polls").contentType(MediaType.APPLICATION_JSON).content("""
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Soup", "Salad"],
                 "resultsShown": "%s"}
                """.formatted(resultsShown)));
            assertThat(result).hasStatus(HttpStatus.CREATED);
            return body(result);
        }

        MvcTestResult places(String poll) {
            return send(mvc.get().uri("/api/polls/" + JsonPath.<String>read(poll, "$.id") + "/places"));
        }

        void close(String poll) {
            var result = send(mvc.patch().uri("/api/polls/" + JsonPath.<String>read(poll, "$.id"))
                .contentType(MediaType.APPLICATION_JSON).content("{\"closed\": true}"));
            assertThat(result).hasStatus(HttpStatus.OK);
        }

        void approve(String poll, int option) {
            var optionId = JsonPath.<Object>read(poll, "$.options[" + option + "].id");
            ballot(poll, "{\"approvedOptionIds\": [\"" + optionId + "\"]}");
        }

        void withdraw(String poll) {
            ballot(poll, "{\"approvedOptionIds\": []}");
        }

        private void ballot(String poll, String json) {
            var id = JsonPath.<String>read(poll, "$.id");
            var result = send(mvc.put().uri("/api/polls/" + id + "/ballot")
                .contentType(MediaType.APPLICATION_JSON).content(json));
            assertThat(result).hasStatus(HttpStatus.OK);
        }

        MvcTestResult send(MockMvcTester.MockMvcRequestBuilder request) {
            if (timeZone != null) {
                request.header(StatisticsService.TIME_ZONE_HEADER, timeZone);
            }
            if (cookie != null) {
                request.cookie(cookie);
            }
            var result = request.exchange();
            var issued = result.getResponse().getCookie(VoterIdentity.COOKIE);
            if (issued != null) {
                cookie = issued;
            }
            return result;
        }

        private static String body(MvcTestResult result) {
            try {
                return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
            } catch (java.io.UnsupportedEncodingException e) {
                throw new IllegalStateException(e);
            }
        }
    }
}
