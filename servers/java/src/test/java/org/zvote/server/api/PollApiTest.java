package org.zvote.server.api;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.test.web.servlet.assertj.MvcTestResult;
import org.springframework.transaction.support.TransactionTemplate;
import org.zvote.server.identity.VoterIdentity;
import org.zvote.server.polls.PollService;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.entry;

/** The HTTP contract of the poll API, exercised the way a client uses it. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PollApiTest {

    @Autowired
    MockMvcTester mvc;

    Voter alice;
    Voter bob;

    @BeforeEach
    void meetTheVoters() {
        alice = Voter.random();
        bob = Voter.random();
    }

    @Nested
    class CreatingAPoll {

        @Test
        void startsWithEveryTallyAtZero() {
            var result = post(alice, "/api/polls", """
                {"title": "Where do we eat?", "votingSystem": "MAJORITY_JUDGMENT",
                 "visibility": "UNLISTED", "options": ["Ramen", "Tacos"]}
                """);

            assertThat(result).hasStatus(HttpStatus.CREATED);
            var id = JsonPath.<String>read(body(result), "$.id");
            assertThat(result).hasHeader(HttpHeaders.LOCATION, "/api/polls/" + id);
            assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Where do we eat?");
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(true);
            assertThat(result).bodyJson().extractingPath("$.closedAt").isNull();
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
            assertThat(result).bodyJson().extractingPath("$.options[*].label").isEqualTo(List.of("Ramen", "Tacos"));
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap().containsExactly(
                entry("Bad", 0), entry("Inadequate", 0), entry("Passable", 0), entry("Fair", 0),
                entry("Good", 0), entry("VeryGood", 0), entry("Excellent", 0));
            assertThat(result).bodyJson().extractingPath("$.createdAt").asString().matches("\\d{4}-\\d{2}-\\d{2}T.*Z");
        }

        @Test
        void trimsTheTitleAndOptions() {
            var result = post(alice, "/api/polls", """
                {"title": "  Lunch?  ", "votingSystem": "APPROVAL",
                 "visibility": "UNLISTED", "options": [" Ramen ", "Tacos\\n"]}
                """);

            assertThat(result).hasStatus(HttpStatus.CREATED);
            assertThat(result).bodyJson().extractingPath("$.title").isEqualTo("Lunch?");
            assertThat(result).bodyJson().extractingPath("$.options[*].label").isEqualTo(List.of("Ramen", "Tacos"));
            assertThat(result).bodyJson().extractingPath("$.options[0].approvalCount").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").isNull();
        }

        @ParameterizedTest(name = "{0}")
        @MethodSource("org.zvote.server.api.PollApiTest#invalidPolls")
        void explainsWhatIsWrong(String json, String explanation) {
            var result = post(alice, "/api/polls", json);

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains(explanation);
        }
    }

    static Stream<Arguments> invalidPolls() {
        var tooMany = IntStream.rangeClosed(1, 21).mapToObj(i -> "\"Option " + i + "\"")
            .collect(Collectors.joining(", ", "[", "]"));
        return Stream.of(
            Arguments.of(poll("  ", "[\"A\", \"B\"]"), "needs a title"),
            Arguments.of(poll("x".repeat(201), "[\"A\", \"B\"]"), "at most 200 characters"),
            Arguments.of(poll("Lunch?", "[\"A\"]"), "between 2 and 20 options"),
            Arguments.of(poll("Lunch?", tooMany), "between 2 and 20 options"),
            Arguments.of(poll("Lunch?", "[\"A\", \" \"]"), "cannot be empty"),
            Arguments.of(poll("Lunch?", "[\"A\", \"" + "x".repeat(101) + "\"]"), "at most 100 characters"),
            Arguments.of(poll("Lunch?", "[\"Ramen\", \"ramen\"]"), "listed twice"),
            Arguments.of("{\"title\": \"Lunch?\", \"visibility\": \"UNLISTED\", \"options\": [\"A\", \"B\"]}",
                "voting system"),
            Arguments.of("{\"title\": \"Lunch?\", \"votingSystem\": \"APPROVAL\", \"options\": [\"A\", \"B\"]}",
                "visibility"),
            Arguments.of("{\"title\": \"Lunch?\", \"votingSystem\": \"APPROVAL\", \"visibility\": \"PRIVATE\","
                + " \"options\": [\"A\", \"B\"]}", "could not be read"),
            Arguments.of("{not json", "could not be read"));
    }

    private static String poll(String title, String options) {
        return """
            {"title": "%s", "votingSystem": "MAJORITY_JUDGMENT", "visibility": "UNLISTED", "options": %s}
            """.formatted(title, options);
    }

    @Nested
    class FindingAPoll {

        @Test
        void publicPollsAreNotOfferedYet() {
            var result = post(alice, "/api/polls", poll("Lunch?", "[\"A\", \"B\"]").replace("UNLISTED", "PUBLIC"));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").isEqualTo("Choose a visibility this server offers.");
            assertThat(get(bob, "/api/polls")).bodyJson().isEqualTo("[]");
        }

        @Test
        void anyoneWithTheLinkCanOpenAnUnlistedPoll() {
            var unlisted = createPoll(alice, "APPROVAL", "UNLISTED");

            var result = get(bob, "/api/polls/" + unlisted);

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(false);
        }

        @Test
        void mineListsTheCallersPollsNewestFirst() {
            var first = createPoll(alice, "APPROVAL", "UNLISTED");
            var second = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");
            createPoll(bob, "APPROVAL", "UNLISTED");

            var result = get(alice, "/api/polls/mine");

            assertThat(JsonPath.<List<String>>read(body(result), "$[*].id")).containsExactly(second, first);
            assertThat(result).bodyJson().extractingPath("$[*].isMine").isEqualTo(List.of(true, true));
        }

        @Test
        void anUnknownPollIsNotFound() {
            var result = get(bob, "/api/polls/no-such-poll");

            assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("does not exist");
        }

        @Test
        void nothingCanBeDoneToAnUnknownPoll() {
            assertThat(put(alice, "/api/polls/no-such-poll/ballot", "{\"judgments\": {}}")).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(patch(alice, "/api/polls/no-such-poll", "{\"closed\": true}")).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(delete(alice, "/api/polls/no-such-poll")).hasStatus(HttpStatus.NOT_FOUND);
        }

        @Test
        void aPollReadsBackExactlyAsItWasAnswered() {
            var created = post(alice, "/api/polls", """
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED", "options": ["Ramen", "Tacos"]}
                """);
            var poll = JsonPath.<String>read(body(created), "$.id");
            var closed = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            var read = body(get(bob, "/api/polls/" + poll));

            assertThat(JsonPath.<String>read(read, "$.createdAt")).isEqualTo(JsonPath.read(body(created), "$.createdAt"));
            assertThat(JsonPath.<String>read(read, "$.closedAt")).isEqualTo(JsonPath.read(body(closed), "$.closedAt"));
        }
    }

    @Nested
    class MajorityJudgmentBallots {

        String poll;
        String ramen;
        String tacos;

        @BeforeEach
        void createPoll() {
            poll = PollApiTest.this.createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");
            var options = optionIds(poll);
            ramen = options.get(0);
            tacos = options.get(1);
        }

        @Test
        void everyBallotIsTallied() {
            castJudgments(alice, "Excellent", "Good");
            var result = castJudgments(bob, "Good", "Bad");

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(2);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap()
                .contains(entry("Excellent", 1), entry("Good", 1), entry("Bad", 0));
            assertThat(result).bodyJson().extractingPath("$.options[1].judgmentCounts").asMap()
                .contains(entry("Good", 1), entry("Bad", 1));
        }

        @Test
        void theVoterGetsTheirBallotBackAndNobodyElseDoes() {
            castJudgments(alice, "Excellent", "Good");

            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot.judgments")
                .asMap().containsExactly(entry(ramen, "Excellent"), entry(tacos, "Good"));
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void castingAgainRevisesTheBallot() {
            castJudgments(alice, "Excellent", "Good");
            var result = castJudgments(alice, "Fair", "Fair");

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
            assertThat(result).bodyJson().extractingPath("$.options[0].judgmentCounts").asMap()
                .contains(entry("Excellent", 0), entry("Fair", 1));
        }

        @Test
        void optionsLeftUngradedCountAsBad() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "VeryGood"}}
                """.formatted(ramen));

            assertThat(result).bodyJson().extractingPath("$.options[1].judgmentCounts").asMap()
                .contains(entry("Bad", 1));
            assertThat(result).bodyJson().extractingPath("$.myBallot.judgments")
                .asMap().containsExactly(entry(ramen, "VeryGood"), entry(tacos, "Bad"));
        }

        @Test
        void anEmptyBallotWithdraws() {
            castJudgments(alice, "Excellent", "Good");
            var result = put(alice, "/api/polls/" + poll + "/ballot", "{\"judgments\": {}}");

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void rejectsWhatIsNotAMention() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Superb"}}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString()
                .contains("\"Superb\" is not a mention", "VeryGood");
        }

        @Test
        void rejectsOptionsOfAnotherPoll() {
            var otherPoll = PollApiTest.this.createPoll(bob, "MAJORITY_JUDGMENT", "UNLISTED");
            var foreign = optionIds(otherPoll).getFirst();

            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Excellent"}}
                """.formatted(foreign));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("not an option of this poll");
        }

        @Test
        void simultaneousBallotsFromOneVoterLeaveOneBallot() throws InterruptedException {
            var statuses = new ConcurrentLinkedQueue<Integer>();
            var voters = IntStream.range(0, 20)
                .mapToObj(i -> Thread.ofVirtual().start(
                    () -> statuses.add(castJudgments(alice, "Good", "Fair").getResponse().getStatus())))
                .toList();
            for (var voter : voters) {
                voter.join();
            }

            assertThat(statuses).hasSize(20).isSubsetOf(200, 409).contains(200);
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
        }

        @Test
        void rejectsAnApprovalBallot() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"approvedOptionIds": ["%s"]}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("majority judgment poll");
        }

        private MvcTestResult castJudgments(Voter voter, String forRamen, String forTacos) {
            return put(voter, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "%s", "%s": "%s"}}
                """.formatted(ramen, forRamen, tacos, forTacos));
        }
    }

    @Nested
    class ApprovalBallots {

        String poll;
        String ramen;
        String tacos;

        @BeforeEach
        void createPoll() {
            poll = PollApiTest.this.createPoll(alice, "APPROVAL", "UNLISTED");
            var options = optionIds(poll);
            ramen = options.get(0);
            tacos = options.get(1);
        }

        @Test
        void countsApprovalsAndVoters() {
            approve(alice, ramen, tacos);
            var result = approve(bob, ramen);

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(2);
            assertThat(result).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(List.of(2, 1));
            assertThat(result).bodyJson().extractingPath("$.myBallot.approvedOptionIds").isEqualTo(List.of(ramen));
        }

        @Test
        void approvingNothingWithdraws() {
            approve(alice, ramen);
            var result = approve(alice);

            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
            assertThat(result).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @ParameterizedTest(name = "\"{0}\"")
        @ValueSource(strings = {"Ramen", "", "-1", "99999999999999999999"})
        void rejectsWhatIsNotAnOptionOfThisPoll(String optionId) {
            var result = approve(alice, ramen, optionId);

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString()
                .isEqualTo("\"" + optionId + "\" is not an option of this poll.");
            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void rejectsAMajorityJudgmentBallot() {
            var result = put(alice, "/api/polls/" + poll + "/ballot", """
                {"judgments": {"%s": "Good"}}
                """.formatted(ramen));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("approval poll");
        }

        private MvcTestResult approve(Voter voter, String... optionIds) {
            var ids = Arrays.stream(optionIds).map(id -> "\"" + id + "\"").collect(Collectors.joining(", "));
            return put(voter, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [" + ids + "]}");
        }
    }

    @Nested
    class ClosingAndDeleting {

        @Test
        void aClosedPollKeepsItsResultsAndRefusesBallots() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");
            var ramen = optionIds(poll).getFirst();
            put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            var closed = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");
            var lateBallot = put(alice, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            assertThat(closed).hasStatus(HttpStatus.OK);
            assertThat(closed).bodyJson().extractingPath("$.closedAt").isNotNull();
            assertThat(closed).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
            assertThat(lateBallot).hasStatus(HttpStatus.CONFLICT);
            assertThat(lateBallot).bodyJson().extractingPath("$.detail").asString().contains("closed");
        }

        @Test
        void aClosedPollStaysClosed() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");
            var closed = JsonPath.<String>read(body(patch(alice, "/api/polls/" + poll, "{\"closed\": true}")), "$.closedAt");

            var reopened = patch(alice, "/api/polls/" + poll, "{\"closed\": false}");
            var closedAgain = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            assertThat(reopened).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(reopened).bodyJson().extractingPath("$.detail")
                .isEqualTo("A poll can only be closed, for good: send {\"closed\": true}.");
            assertThat(closedAgain).bodyJson().extractingPath("$.closedAt").isEqualTo(closed);
        }

        @Test
        void onlyTheCreatorCanCloseOrDelete() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");

            assertThat(patch(bob, "/api/polls/" + poll, "{\"closed\": true}")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(delete(bob, "/api/polls/" + poll)).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.closedAt").isNull();
        }

        @Test
        void deletingRemovesThePollForEveryone() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");
            var ramen = optionIds(poll).getFirst();
            put(bob, "/api/polls/" + poll + "/ballot", "{\"judgments\": {\"" + ramen + "\": \"Good\"}}");

            assertThat(delete(alice, "/api/polls/" + poll)).hasStatus(HttpStatus.NO_CONTENT);
            assertThat(get(bob, "/api/polls/" + poll)).hasStatus(HttpStatus.NOT_FOUND);
        }

        @Test
        void aChangeMustSayWhatToChange() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");

            assertThat(patch(alice, "/api/polls/" + poll, "{}")).hasStatus(HttpStatus.BAD_REQUEST);
        }
    }

    @Nested
    class JoiningWithACode {

        @Test
        void everyPollHasASixCharacterCodeWithoutLookAlikes() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            assertThat(JsonPath.<String>read(body(get(bob, "/api/polls/" + poll)), "$.joinCode"))
                .matches("[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}");
        }

        @Test
        void theCodeLeadsToThePollHoweverItIsTyped() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");
            var code = JsonPath.<String>read(body(get(alice, "/api/polls/" + poll)), "$.joinCode");
            var typed = code.substring(0, 3).toLowerCase() + " \u2013 " + code.substring(3); // an en dash, pasted

            var result = get(bob, "/api/join/" + typed);

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.id").isEqualTo(poll);
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(false);
        }

        @Test
        void anUnknownCodeIsNotFound() {
            var result = get(bob, "/api/join/AAAAAA");

            assertThat(result).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(result).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().startsWith("No poll has this code.");
        }
    }

    @Nested
    class VoterNames {

        String poll;
        String ramen;

        @BeforeEach
        void createPollShowingNames() {
            var created = post(alice, "/api/polls", """
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "showVoterNames": true, "options": ["Ramen", "Tacos"]}
                """);
            poll = JsonPath.read(body(created), "$.id");
            ramen = JsonPath.<List<String>>read(body(created), "$.options[*].id").getFirst();
            assertThat(created).bodyJson().extractingPath("$.showVoterNames").isEqualTo(true);
            assertThat(created).bodyJson().extractingPath("$.voterNames").isEqualTo(List.of());
        }

        @Test
        void namesShowWhoTookPartInAlphabeticalOrder() {
            approve(bob, "  Zoé ");
            approve(alice, "alice");
            approve(Voter.random(), null);
            approve(Voter.random(), "Émile");
            approve(bob, "Bob");

            var result = get(Voter.random(), "/api/polls/" + poll);

            assertThat(result).bodyJson().extractingPath("$.voterNames").isEqualTo(List.of("alice", "Bob", "Émile"));
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(4);
        }

        @Test
        void theCloudShowsTheFirstHundredNamesAlphabetically() {
            for (int i = 100; i >= 0; i--) {
                approve(Voter.random(), "Voter %03d".formatted(i));
            }

            var result = get(Voter.random(), "/api/polls/" + poll);

            assertThat(JsonPath.<List<String>>read(body(result), "$.voterNames"))
                .hasSize(100).startsWith("Voter 000").endsWith("Voter 099");
            assertThat(result).bodyJson().extractingPath("$.moreVoterNames").isEqualTo(true);
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(101);
        }

        @Test
        void theVoterGetsTheirNameBackWithTheirBallot() {
            var result = approve(bob, "Bob");

            assertThat(result).bodyJson().extractingPath("$.myBallot.voterName").isEqualTo("Bob");
            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void aBallotWithoutANameIsAnonymous() {
            approve(bob, "Bob");

            var result = approve(bob, " ");

            assertThat(result).bodyJson().extractingPath("$.voterNames").isEqualTo(List.of());
            assertThat(result).bodyJson().extractingPath("$.myBallot.voterName").isNull();
        }

        @Test
        void withdrawingTheBallotTakesTheNameAway() {
            approve(bob, "Bob");

            var result = put(bob, "/api/polls/" + poll + "/ballot", """
                {"approvedOptionIds": [], "voterName": "Bob"}
                """);

            assertThat(result).bodyJson().extractingPath("$.voterNames").isEqualTo(List.of());
        }

        @Test
        void aNameMustBeShortAndVisible() {
            assertThat(approve(bob, "x".repeat(41))).bodyJson().extractingPath("$.detail")
                .isEqualTo("A name can be at most 40 characters long.");
            assertThat(approve(bob, "\\u202Eboj")).bodyJson().extractingPath("$.detail")
                .isEqualTo("A name can only hold visible characters.");
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot").isNull();
        }

        @Test
        void aNameKeepsSingleSpacesBetweenItsWords() {
            assertThat(approve(bob, "Bob\\tSmith\\u2028Jr")).bodyJson().extractingPath("$.myBallot.voterName")
                .isEqualTo("Bob Smith Jr");
            assertThat(approve(alice, "\\u00A0")).bodyJson().extractingPath("$.myBallot.voterName").isNull();
        }

        @Test
        void aPollThatHidesNamesRefusesThem() {
            var hiding = createPoll(alice, "APPROVAL", "UNLISTED");
            var option = optionIds(hiding).getFirst();

            var result = put(bob, "/api/polls/" + hiding + "/ballot", """
                {"approvedOptionIds": ["%s"], "voterName": "Bob"}
                """.formatted(option));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().contains("does not show names");
            assertThat(get(bob, "/api/polls/" + hiding)).bodyJson().extractingPath("$.voterNames").isNull();
        }

        private MvcTestResult approve(Voter voter, String name) {
            var voterName = name == null ? "null" : "\"" + name + "\"";
            return put(voter, "/api/polls/" + poll + "/ballot", """
                {"approvedOptionIds": ["%s"], "voterName": %s}
                """.formatted(ramen, voterName));
        }
    }

    /** Polls only invited people may vote on: one link each, sent by the creator. */
    @Nested
    class Invitations {

        String poll;
        String ramen;
        Voter carol;

        @BeforeEach
        void createPollTakingInvitations() {
            poll = createPoll(alice, "APPROVAL", "UNLISTED", "\"invitationOnly\": true");
            ramen = optionIds(poll).getFirst();
            carol = Voter.random();
        }

        @Test
        void onlyInvitedPeopleCanVote() {
            var view = get(bob, "/api/polls/" + poll);
            assertThat(view).bodyJson().extractingPath("$.invitationOnly").isEqualTo(true);
            assertThat(view).bodyJson().extractingPath("$.admission").isEqualTo("NOT_INVITED");

            var result = approve(bob, null);

            assertThat(result).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(result).bodyJson().extractingPath("$.detail").asString().startsWith("Only invited people");
            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
        }

        @Test
        void anInvitationHoldsOneBallotThatOnlyTheBrowserWhichCastItCanChange() {
            var invitation = invite("Bob");
            assertThat(read(bob, invitation)).bodyJson().extractingPath("$.admission").isEqualTo("ADMITTED");

            assertThat(approve(bob, invitation)).hasStatus(HttpStatus.OK);
            var revised = put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": []}");

            assertThat(revised).hasStatus(HttpStatus.OK);
            assertThat(revised).bodyJson().extractingPath("$.admission").isEqualTo("ADMITTED");
            assertThat(read(carol, invitation)).bodyJson().extractingPath("$.admission").isEqualTo("INVITATION_USED");
            assertThat(approve(carol, invitation)).hasStatus(HttpStatus.CONFLICT);
            assertThat(approve(carol, invitation)).bodyJson().extractingPath("$.detail").asString()
                .startsWith("This invitation was already used");
        }

        @Test
        void aNamedInvitationIsUsedLikeAnAnonymousOne() {
            var named = invite("Bob");
            var anonymous = invite(null);

            approve(bob, named);
            approve(carol, anonymous);

            assertThat(page("")).bodyJson().extractingPath("$.invitations[*].used").isEqualTo(List.of(true, true));
            assertThat(approve(Voter.random(), anonymous)).hasStatus(HttpStatus.CONFLICT);
        }

        @Test
        void theCreatorHoldsEveryLinkButNeitherReadsNorChangesTheBallotsCastWithThem() {
            var invitation = invite("Bob");
            approve(bob, invitation);

            var asCreator = read(alice, invitation);
            var castAsCreator = put(alice, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": []}");

            assertThat(asCreator).bodyJson().extractingPath("$.myBallot").isNull();
            assertThat(castAsCreator).bodyJson().extractingPath("$.myBallot").isNull();
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.myBallot.approvedOptionIds")
                .isEqualTo(List.of(ramen));
        }

        @Test
        void theCreatorVotesWithoutAnInvitation() {
            assertThat(get(alice, "/api/polls/" + poll)).bodyJson().extractingPath("$.admission").isEqualTo("ADMITTED");

            assertThat(approve(alice, null)).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
        }

        @Test
        void aLinkThatIsNotAnInvitationToThisPollLetsNobodyIn() {
            invite(null);
            var otherPoll = createPoll(alice, "APPROVAL", "UNLISTED", "\"invitationOnly\": true");
            var elsewhere = JsonPath.<String>read(
                body(post(alice, "/api/polls/" + otherPoll + "/invitations", "{}")), "$.invitations[0].token");
            var signature = elsewhere.substring(elsewhere.indexOf('.'));

            for (var invitation : List.of(elsewhere, "2" + signature, "made-up")) {
                assertThat(read(bob, invitation)).bodyJson().extractingPath("$.admission").isEqualTo("NOT_INVITED");
                assertThat(approve(bob, invitation)).hasStatus(HttpStatus.FORBIDDEN);
                assertThat(approve(bob, invitation)).bodyJson().extractingPath("$.detail")
                    .isEqualTo("This invitation link is not valid. Ask whoever invited you for a new one.");
            }
        }

        @Test
        void aBrowserUsesOneInvitationPerPoll() {
            var first = invite("Bob");
            var second = invite("Bob again");

            approve(bob, first);
            var again = approve(bob, second);

            assertThat(again).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
            assertThat(page("")).bodyJson().extractingPath("$.invitations[*].used").isEqualTo(List.of(false, true));
        }

        @Test
        void theCreatorSeesThemNewestFirstWithWhetherTheyWereUsedNeverWithWhichBallot() {
            var forBob = invite("Bob");
            invite(null);
            invite("  Zoé\\tM. ");
            approve(bob, forBob);

            var result = page("");

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result).bodyJson().extractingPath("$.count").isEqualTo(3);
            assertThat(result).bodyJson().extractingPath("$.invitations[*].number").isEqualTo(List.of(3, 2, 1));
            assertThat(result).bodyJson().extractingPath("$.invitations[*].label")
                .isEqualTo(Arrays.asList("Zoé M.", null, "Bob"));
            assertThat(result).bodyJson().extractingPath("$.invitations[*].used").isEqualTo(List.of(false, false, true));
            assertThat(result).bodyJson().extractingPath("$.invitations[0]").asMap()
                .containsOnlyKeys("number", "token", "link", "label", "used");
            assertThat(result).bodyJson().extractingPath("$.next").isNull();
        }

        /** A creator with a list of people asks once, and sends each their link. */
        @Test
        void oneRequestInvitesAWholeGroupByName() {
            var names = IntStream.rangeClosed(1, 100).mapToObj(n -> "\"Voter " + n + "\"")
                .collect(Collectors.joining(", "));

            var made = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [" + names + "]}");

            assertThat(made).hasStatus(HttpStatus.CREATED);
            assertThat(made).bodyJson().extractingPath("$.count").isEqualTo(100);
            assertThat(made).bodyJson().extractingPath("$.invitations[*].number").asList().startsWith(100, 99);
            assertThat(made).bodyJson().extractingPath("$.invitations[*].label").asList()
                .startsWith("Voter 100", "Voter 99").endsWith("Voter 1");
            assertThat(made).bodyJson().extractingPath("$.invitations[0].link").asString()
                .isEqualTo("https://zvote.test/p/" + poll + "#invitation="
                    + JsonPath.<String>read(body(made), "$.invitations[0].token"));
        }

        @Test
        void aGroupIsNamedAPageAtATime() {
            var names = IntStream.rangeClosed(1, 101).mapToObj(n -> "\"Voter " + n + "\"")
                .collect(Collectors.joining(", "));

            var tooMany = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [" + names + "]}");

            assertThat(tooMany).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(tooMany).bodyJson().extractingPath("$.detail")
                .isEqualTo("Name up to 100 invitations at a time.");
        }

        @Test
        void aBlankNameIsLeftOutRatherThanEmpty() {
            var blank = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"Bob\", \" \"]}");

            assertThat(blank).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(blank).bodyJson().extractingPath("$.detail")
                .isEqualTo("An invitation's name cannot be blank: leave it out instead.");
            assertThat(page("")).bodyJson().extractingPath("$.count").isEqualTo(0);
        }

        @Test
        void manyAreMadeAtOnceAndReadAPageAtATime() {
            var made = post(alice, "/api/polls/" + poll + "/invitations", "{\"count\": 250}");

            assertThat(made).hasStatus(HttpStatus.CREATED);
            assertThat(made).bodyJson().extractingPath("$.count").isEqualTo(250);
            assertThat(JsonPath.<List<Integer>>read(body(made), "$.invitations[*].number")).hasSize(100).startsWith(250);
            assertThat(made).bodyJson().extractingPath("$.next").isEqualTo(151);
            var last = page("?before=51&limit=60");
            assertThat(JsonPath.<List<Integer>>read(body(last), "$.invitations[*].number")).hasSize(50).endsWith(1);
            assertThat(last).bodyJson().extractingPath("$.next").isNull();
            var token = JsonPath.<String>read(body(last), "$.invitations[49].token");
            assertThat(approve(bob, token)).hasStatus(HttpStatus.OK);
        }

        @Test
        void aPageHoldsOneToAThousand() {
            assertThat(page("?limit=0")).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(page("?limit=1001")).bodyJson().extractingPath("$.detail")
                .isEqualTo("Ask for 1 to 1000 invitations at a time.");
            assertThat(page("?limit=1000")).hasStatus(HttpStatus.OK);
        }

        @Test
        void aPollHasAtMostAThousandOfThemByDefault() {
            assertThat(post(alice, "/api/polls/" + poll + "/invitations", "{\"count\": 999}")).hasStatus(HttpStatus.CREATED);

            assertThat(post(alice, "/api/polls/" + poll + "/invitations", "{\"count\": 2}")).bodyJson()
                .extractingPath("$.detail").isEqualTo("A poll can have at most 1000 invitations, and this one has 999.");
            assertThat(post(alice, "/api/polls/" + poll + "/invitations", "{}")).hasStatus(HttpStatus.CREATED);
        }

        @Test
        void aNameGoesOnOneInvitationAndFollowsTheRulesOfNames() {
            var several = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"Bob\"], \"count\": 2}");
            var none = post(alice, "/api/polls/" + poll + "/invitations", "{\"count\": 0}");
            var tooLong = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"" + "x".repeat(41) + "\"]}");
            var invisible = post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"\\u202Eboj\"]}");

            assertThat(several).bodyJson().extractingPath("$.detail")
                .isEqualTo("Send names, or a number of invitations, not both.");
            assertThat(none).bodyJson().extractingPath("$.detail").isEqualTo("Make at least one invitation.");
            assertThat(tooLong).bodyJson().extractingPath("$.detail").isEqualTo("A name can be at most 40 characters long.");
            assertThat(invisible).bodyJson().extractingPath("$.detail").isEqualTo("A name can only hold visible characters.");
            assertThat(page("")).bodyJson().extractingPath("$.count").isEqualTo(0);
        }

        @Test
        void onlyItsCreatorManagesThem() {
            invite("Bob");

            assertThat(get(bob, "/api/polls/" + poll + "/invitations")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(post(bob, "/api/polls/" + poll + "/invitations", "{}")).hasStatus(HttpStatus.FORBIDDEN);
            assertThat(delete(bob, "/api/polls/" + poll + "/invitations/1")).hasStatus(HttpStatus.FORBIDDEN);
        }

        @Test
        void oneNobodyVotedWithCanBeTakenBack() {
            var named = invite("Bob");
            var anonymous = invite(null);
            var used = invite("Carol");
            approve(carol, used);

            assertThat(revoke(1)).hasStatus(HttpStatus.NO_CONTENT);
            assertThat(revoke(2)).hasStatus(HttpStatus.NO_CONTENT);
            assertThat(revoke(2)).hasStatus(HttpStatus.NO_CONTENT);
            assertThat(revoke(99)).hasStatus(HttpStatus.NO_CONTENT);

            for (var takenBack : List.of(named, anonymous)) {
                assertThat(read(bob, takenBack)).bodyJson().extractingPath("$.admission").isEqualTo("NOT_INVITED");
                assertThat(approve(bob, takenBack)).hasStatus(HttpStatus.FORBIDDEN);
            }
            var left = page("");
            assertThat(left).bodyJson().extractingPath("$.count").isEqualTo(1);
            assertThat(left).bodyJson().extractingPath("$.invitations[*].label").isEqualTo(List.of("Carol"));
            assertThat(revoke(3)).hasStatus(HttpStatus.CONFLICT);
            assertThat(revoke(3)).bodyJson().extractingPath("$.detail")
                .isEqualTo("Someone has voted with this invitation, so it can no longer be taken back.");
        }

        @Test
        void aPollOpenToAnyoneTakesNone() {
            var open = createPoll(alice, "APPROVAL", "UNLISTED");

            var result = post(alice, "/api/polls/" + open + "/invitations", "{}");

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(get(alice, "/api/polls/" + open + "/invitations")).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(get(bob, "/api/polls/" + open)).bodyJson().extractingPath("$.admission").isEqualTo("ADMITTED");
        }

        @Test
        void aClosedPollTakesNoMore() {
            patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            var result = post(alice, "/api/polls/" + poll + "/invitations", "{}");

            assertThat(result).hasStatus(HttpStatus.CONFLICT);
            assertThat(result).bodyJson().extractingPath("$.detail")
                .isEqualTo("This poll is closed: nobody else can vote on it.");
        }

        /** Makes an invitation, and returns the token its link carries. */
        String invite(String label) {
            var result = post(alice, "/api/polls/" + poll + "/invitations",
                label == null ? "{}" : "{\"labels\": [\"" + label + "\"]}");
            assertThat(result).hasStatus(HttpStatus.CREATED);
            return JsonPath.read(body(result), "$.invitations[0].token");
        }

        MvcTestResult page(String query) {
            return get(alice, "/api/polls/" + poll + "/invitations" + query);
        }

        MvcTestResult revoke(long number) {
            return delete(alice, "/api/polls/" + poll + "/invitations/" + number);
        }

        /** The poll as someone who opened this invitation's link sees it. */
        MvcTestResult read(Voter voter, String invitation) {
            return mvc.get().uri("/api/polls/" + poll).cookie(voter.cookie())
                .header(InvitationController.HEADER, invitation).exchange();
        }

        MvcTestResult approve(Voter voter, String invitation) {
            var request = mvc.put().uri("/api/polls/" + poll + "/ballot").cookie(voter.cookie())
                .contentType(MediaType.APPLICATION_JSON).content("{\"approvedOptionIds\": [\"" + ramen + "\"]}");
            return (invitation == null ? request : request.header(InvitationController.HEADER, invitation)).exchange();
        }
    }

    @Nested
    class Retention {

        @Autowired
        PollRetention retention;

        @Autowired
        JdbcClient jdbc;

        Long idOf(String poll) {
            return jdbc.sql("SELECT id FROM poll WHERE share_token = :token").param("token", poll).query(Long.class).single();
        }

        @Test
        void aPollSaysWhenItWillBeDeleted() {
            var result = get(alice, "/api/polls/" + createPoll(alice, "APPROVAL", "UNLISTED"));

            var createdAt = Instant.parse(JsonPath.read(body(result), "$.createdAt"));
            var expiresAt = Instant.parse(JsonPath.read(body(result), "$.expiresAt"));
            assertThat(expiresAt).isEqualTo(createdAt.plus(Duration.ofDays(30)));
        }

        @Test
        void pollsAreDeletedWithTheirBallotsOnceTheirLifetimeIsOver() {
            var old = createPoll(alice, "APPROVAL", "UNLISTED");
            var recent = createPoll(alice, "APPROVAL", "UNLISTED");
            put(bob, "/api/polls/" + old + "/ballot", "{\"approvedOptionIds\": [\"" + optionIds(old).getFirst() + "\"]}");
            var oldId = idOf(old);
            jdbc.sql("UPDATE poll SET created_at = :createdAt WHERE share_token = :token")
                .param("createdAt", OffsetDateTime.now(ZoneOffset.UTC).minusDays(31))
                .param("token", old)
                .update();

            retention.run();

            assertThat(get(bob, "/api/polls/" + old)).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(get(bob, "/api/polls/" + recent)).hasStatus(HttpStatus.OK);
            assertThat(rowsOf("ballot", oldId)).isZero();
        }

        @Test
        void aDeletedPollGoesAtOnceAndItsBallotsAndNamesRightAfter() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED", "\"showVoterNames\": true");
            put(bob, "/api/polls/" + poll + "/ballot", """
                {"approvedOptionIds": ["%s"], "voterName": "Bob"}
                """.formatted(optionIds(poll).getFirst()));
            var id = idOf(poll);

            delete(alice, "/api/polls/" + poll);
            assertThat(get(bob, "/api/polls/" + poll)).hasStatus(HttpStatus.NOT_FOUND);
            assertThat(rowsOf("ballot", id)).isOne();

            retention.run();

            assertThat(rowsOf("ballot", id)).isZero();
            assertThat(rowsOf("voter_name", id)).isZero();
            assertThat(jdbc.sql("SELECT COUNT(*) FROM poll_removal").query(Long.class).single()).isZero();
        }

        @Test
        void aDeletedPollsInvitationsGoRightAfterIt() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED", "\"invitationOnly\": true");
            post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"Bob\"]}");
            post(alice, "/api/polls/" + poll + "/invitations", "{\"count\": 999}");
            var id = idOf(poll);

            delete(alice, "/api/polls/" + poll);
            assertThat(rowsOf("invitation_count", id)).isZero();
            assertThat(rowsOf("invitation", id)).isOne();

            retention.run();

            assertThat(rowsOf("invitation", id)).isZero();
        }

        long rowsOf(String table, long pollId) {
            return jdbc.sql("SELECT COUNT(*) FROM " + table + " WHERE poll_id = :poll")
                .param("poll", pollId).query(Long.class).single();
        }
    }

    @Nested
    class ResultsKeptBack {

        @Test
        void aPollShowingWhoVotedShowsItsResultsOnceClosedUnlessAskedOtherwise() {
            assertThat(resultsShown("\"showVoterNames\": true")).isEqualTo("AFTER_CLOSING");
            assertThat(resultsShown("\"invitationOnly\": true")).isEqualTo("AFTER_CLOSING");
            assertThat(resultsShown("\"showVoterNames\": true, \"resultsShown\": \"LIVE\"")).isEqualTo("LIVE");
            assertThat(resultsShown("\"showVoterNames\": false")).isEqualTo("LIVE");
        }

        @Test
        void whileThePollIsOpenNobodySeesTheTalliesNotEvenItsCreator() {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED", "\"resultsShown\": \"AFTER_CLOSING\"");
            var ramen = optionIds(poll).getFirst();

            var cast = put(bob, "/api/polls/" + poll + "/ballot", "{\"judgments\": {\"" + ramen + "\": \"Good\"}}");
            var seen = get(alice, "/api/polls/" + poll);

            assertThat(cast).bodyJson().extractingPath("$.myBallot.judgments").asMap().containsEntry(ramen, "Good");
            for (var result : List.of(cast, seen)) {
                assertThat(result).bodyJson().extractingPath("$.resultsShown").isEqualTo("AFTER_CLOSING");
                assertThat(result).bodyJson().extractingPath("$.resultsAfterBallots").isNull();
                assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(1);
                assertThat(result).bodyJson().extractingPath("$.options[*].judgmentCounts").isEqualTo(Arrays.asList(null, null));
            }
        }

        @Test
        void closingThePollShowsThem() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED", "\"resultsShown\": \"AFTER_CLOSING\"");
            var ramen = optionIds(poll).getFirst();
            put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");

            var closed = patch(alice, "/api/polls/" + poll, "{\"closed\": true}");

            assertThat(closed).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(List.of(1, 0));
        }

        @Test
        void resultsShownAfterSomeBallotsShowOnceThatManyAreIn() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED",
                "\"resultsShown\": \"AFTER_BALLOTS\", \"resultsAfterBallots\": 3");
            var ramen = optionIds(poll).getFirst();
            var approveRamen = "{\"approvedOptionIds\": [\"" + ramen + "\"]}";
            put(alice, "/api/polls/" + poll + "/ballot", approveRamen);
            var second = put(bob, "/api/polls/" + poll + "/ballot", approveRamen);
            var carol = Voter.random();

            var third = put(carol, "/api/polls/" + poll + "/ballot", approveRamen);
            var withdrawn = put(carol, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": []}");

            assertThat(second).bodyJson().extractingPath("$.resultsAfterBallots").isEqualTo(3);
            assertThat(second).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(Arrays.asList(null, null));
            assertThat(third).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(List.of(3, 0));
            assertThat(withdrawn).bodyJson().extractingPath("$.options[*].approvalCount").isEqualTo(Arrays.asList(null, null));
        }

        @ParameterizedTest(name = "{0}")
        @ValueSource(strings = {"", ", \"resultsAfterBallots\": 2"})
        void resultsShownAfterSomeBallotsNeedAtLeastThree(String threshold) {
            var result = post(alice, "/api/polls", """
                {"title": "Lunch?", "votingSystem": "APPROVAL", "visibility": "UNLISTED",
                 "options": ["Ramen", "Tacos"], "resultsShown": "AFTER_BALLOTS"%s}
                """.formatted(threshold));

            assertThat(result).hasStatus(HttpStatus.BAD_REQUEST);
            assertThat(result).bodyJson().extractingPath("$.detail")
                .isEqualTo("Results shown after a number of ballots need at least 3 ballots.");
        }

        @Test
        void aThresholdCanBeBillionsOfBallots() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED",
                "\"resultsShown\": \"AFTER_BALLOTS\", \"resultsAfterBallots\": 5000000000");

            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.resultsAfterBallots")
                .isEqualTo(5_000_000_000L);
        }

        private String resultsShown(String choice) {
            return JsonPath.read(body(get(bob, "/api/polls/" + createPoll(alice, "APPROVAL", "UNLISTED", choice))),
                "$.resultsShown");
        }
    }

    /** Tallies are stored and folded from what ballots change: they must add up, whatever the order. */
    @Nested
    class Tallies {

        @Autowired
        JdbcClient jdbc;

        @Test
        void manyVotersRevisingAndWithdrawingAtOnceAddUpExactly() throws InterruptedException {
            var poll = createPoll(alice, "MAJORITY_JUDGMENT", "UNLISTED");
            var options = optionIds(poll);
            var mentions = List.of("Bad", "Inadequate", "Passable", "Fair", "Good", "VeryGood", "Excellent");
            var voters = IntStream.range(0, 60).mapToObj(v -> Thread.ofVirtual().start(() -> {
                var voter = Voter.random();
                for (int round = 0; round < 3; round++) {
                    put(voter, "/api/polls/" + poll + "/ballot", """
                        {"judgments": {"%s": "%s", "%s": "%s"}}
                        """.formatted(options.get(0), mentions.get((v + round) % 7),
                        options.get(1), mentions.get((3 * v + round) % 7)));
                }
                if (v % 5 == 0) {
                    put(voter, "/api/polls/" + poll + "/ballot", "{\"judgments\": {}}");
                }
            })).toList();
            for (var voter : voters) {
                voter.join();
            }

            var result = get(bob, "/api/polls/" + poll);

            var ballots = jdbc.sql("SELECT choices FROM ballot WHERE poll_id = (SELECT id FROM poll WHERE share_token = :token)")
                .param("token", poll).query(byte[].class).list();
            assertThat(ballots).hasSize(48);
            assertThat(result).bodyJson().extractingPath("$.totalBallots").isEqualTo(48);
            for (int position = 0; position < 2; position++) {
                for (int rank = 0; rank < 7; rank++) {
                    int option = position;
                    int mention = rank;
                    assertThat(result).bodyJson()
                        .extractingPath("$.options[" + position + "].judgmentCounts." + mentions.get(rank))
                        .isEqualTo((int) ballots.stream().filter(choices -> choices[option] == mention).count());
                }
            }
        }
    }

    /** What a copy of the database would tell about who voted what: nothing. */
    @Nested
    class Anonymity {

        @Autowired
        JdbcClient jdbc;

        @Test
        void ballotsAndNamesShareNoKeyWithEachOtherWithOtherPollsOrWithTheCreator() {
            var lunch = createPoll(alice, "APPROVAL", "UNLISTED", "\"showVoterNames\": true");
            var dinner = createPoll(alice, "APPROVAL", "UNLISTED", "\"showVoterNames\": true");
            for (var poll : List.of(lunch, dinner)) {
                for (var voter : List.of(alice, bob)) {
                    put(voter, "/api/polls/" + poll + "/ballot", """
                        {"approvedOptionIds": ["%s"], "voterName": "Someone"}
                        """.formatted(optionIds(poll).getFirst()));
                }
            }

            var lunchBallots = keys("SELECT ballot_key FROM ballot", lunch);
            var dinnerBallots = keys("SELECT ballot_key FROM ballot", dinner);
            var names = new HashSet<String>(keys("SELECT name_key FROM voter_name", lunch));
            names.addAll(keys("SELECT name_key FROM voter_name", dinner));

            assertThat(lunchBallots).hasSize(2).doesNotContainAnyElementsOf(dinnerBallots);
            assertThat(names).hasSize(4)
                .doesNotContainAnyElementsOf(lunchBallots)
                .doesNotContainAnyElementsOf(dinnerBallots)
                .doesNotContain(voterIdOf(alice), voterIdOf(bob));
            assertThat(lunchBallots).doesNotContain(voterIdOf(alice), voterIdOf(bob));
        }

        @Test
        void anInvitationSharesNoKeyWithTheBallotOrTheNameCastWithIt() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED", "\"invitationOnly\": true, \"showVoterNames\": true");
            var invitation = JsonPath.<String>read(
                body(post(alice, "/api/polls/" + poll + "/invitations", "{\"labels\": [\"Bob\"]}")),
                "$.invitations[0].token");
            mvc.put().uri("/api/polls/" + poll + "/ballot").cookie(bob.cookie())
                .header(InvitationController.HEADER, invitation)
                .contentType(MediaType.APPLICATION_JSON).content("""
                    {"approvedOptionIds": ["%s"], "voterName": "Bob"}
                    """.formatted(optionIds(poll).getFirst()))
                .exchange();

            var ballots = keys("SELECT ballot_key FROM ballot", poll);
            var names = keys("SELECT name_key FROM voter_name", poll);

            assertThat(ballots).hasSize(1);
            assertThat(names).hasSize(1);
            assertThat(keys("SELECT used_by FROM invitation", poll)).hasSize(1)
                .doesNotContainAnyElementsOf(ballots)
                .doesNotContainAnyElementsOf(names)
                .doesNotContain(voterIdOf(bob));
        }

        /** An invitation's link is signed: the database holds no link anyone could vote with. */
        @Test
        void noLinkIsStored() {
            var columns = jdbc.sql("""
                    SELECT LOWER(column_name) FROM information_schema.columns WHERE LOWER(table_name) = 'invitation'
                    """)
                .query(String.class).list();

            assertThat(columns).containsExactlyInAnyOrder("poll_id", "number", "label", "used_by", "revoked");
        }

        @Test
        void nothingRecordsWhenABallotOrANameWasGiven() {
            assertThat(timestampColumns("poll")).as("poll: created_at, closed_at").isEqualTo(2);
            for (var table : List.of("ballot", "ballot_change", "tally", "ballot_count", "voter_name", "invitation")) {
                assertThat(timestampColumns(table)).as(table).isZero();
            }
        }

        private long timestampColumns(String table) {
            return jdbc.sql("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE LOWER(table_name) = :table AND UPPER(data_type) LIKE 'TIMESTAMP%'
                    """)
                .param("table", table).query(Long.class).single();
        }

        private List<String> keys(String select, String poll) {
            return jdbc.sql(select + " WHERE poll_id = (SELECT id FROM poll WHERE share_token = :token)")
                .param("token", poll).query(String.class).list();
        }
    }

    /** A ballot cast while its poll is being closed or deleted waits for that change, then obeys it. */
    @Nested
    class ChangesAtTheSameMoment {

        @Autowired
        PollService pollService;

        @Autowired
        TransactionTemplate transactions;

        @Test
        void aBallotCastWhileThePollClosesIsRefused() throws InterruptedException {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            var ballot = castWhile(poll, 300, () -> pollService.close(poll, voterIdOf(alice)));

            assertThat(ballot).hasStatus(HttpStatus.CONFLICT);
            assertThat(ballot).bodyJson().extractingPath("$.detail").asString().contains("closed");
            assertThat(get(bob, "/api/polls/" + poll)).bodyJson().extractingPath("$.totalBallots").isEqualTo(0);
        }

        @Test
        void aBallotCastWhileThePollIsDeletedFindsItGone() throws InterruptedException {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            var ballot = castWhile(poll, 300, () -> pollService.delete(poll, voterIdOf(alice)));

            assertThat(ballot).hasStatus(HttpStatus.NOT_FOUND);
        }

        @Test
        void aBallotKeptWaitingTooLongIsToldToTryAgain() throws InterruptedException {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            var ballot = castWhile(poll, 2500, () -> pollService.close(poll, voterIdOf(alice)));

            assertThat(ballot).hasStatus(HttpStatus.CONFLICT);
            assertThat(ballot).bodyJson().extractingPath("$.detail").asString().contains("Please try again");
        }

        /** Bob casts a ballot while {@code change} is made in a transaction that stays open a while. */
        MvcTestResult castWhile(String poll, long openMillis, Runnable change) throws InterruptedException {
            var ramen = optionIds(poll).getFirst();
            var changed = new CountDownLatch(1);
            var changer = Thread.ofVirtual().start(() -> transactions.executeWithoutResult(status -> {
                change.run();
                changed.countDown();
                pause(openMillis);
            }));
            changed.await();
            var ballot = put(bob, "/api/polls/" + poll + "/ballot", "{\"approvedOptionIds\": [\"" + ramen + "\"]}");
            changer.join();
            return ballot;
        }

        static void pause(long millis) {
            try {
                Thread.sleep(millis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Nested
    class Identity {

        @Test
        void aNewcomerIsGivenAnHttpOnlyVoterCookie() {
            var result = mvc.get().uri("/api/polls").exchange();

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(VoterIdentity.COOKIE + "=")
                .contains("HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=");
        }

        @Test
        void aKnownVoterKeepsTheirIdentity() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            var result = get(alice, "/api/polls/" + poll);

            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
            assertThat(result).bodyJson().extractingPath("$.isMine").isEqualTo(true);
        }

        @Test
        void aCookieTheServerCouldNotHaveIssuedIsReplaced() {
            var result = mvc.get().uri("/api/polls")
                .cookie(new Cookie(VoterIdentity.COOKIE, "alice")).exchange();

            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .startsWith(VoterIdentity.COOKIE + "=")
                .doesNotStartWith(VoterIdentity.COOKIE + "=alice");
        }

        @Test
        void neitherTheTokenNorTheVoterIdIsEverSent() {
            var poll = createPoll(alice, "APPROVAL", "UNLISTED");

            var body = body(get(alice, "/api/polls/" + poll));

            assertThat(body)
                .doesNotContain(alice.token())
                .doesNotContain(VoterIdentity.voterIdOf(alice.token()))
                .doesNotContain("creator");
        }

        @Test
        void healthChecksDoNotGetACookie() {
            var result = mvc.get().uri("/actuator/health").exchange();

            assertThat(result).hasStatus(HttpStatus.OK);
            assertThat(result.getResponse().getHeader(HttpHeaders.SET_COOKIE)).isNull();
        }
    }

    @Test
    void theServerSaysWhatItOffers() {
        var result = get(alice, "/api/server-info");

        assertThat(result).bodyJson().extractingPath("$.features").asMap().containsOnly(
            entry("publicPolls", false), entry("unlistedPolls", true),
            entry("approvalVoting", true), entry("majorityJudgment", true));
        assertThat(result).bodyJson().extractingPath("$.limits").asMap().containsOnly(
            entry("maxOptions", 20), entry("maxTitleLength", 200), entry("maxOptionLength", 100),
            entry("maxVoterNameLength", 40), entry("maxInvitations", 1000), entry("pollLifetimeDays", 30));
    }

    @Test
    void springsOwnErrorsAreProblemDocumentsToo() {
        var wrongMethod = delete(alice, "/api/polls");
        var nothingThere = get(alice, "/api/nothing-here");

        assertThat(wrongMethod).hasStatus(HttpStatus.METHOD_NOT_ALLOWED);
        assertThat(wrongMethod).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
        assertThat(nothingThere).hasStatus(HttpStatus.NOT_FOUND);
        assertThat(nothingThere).hasContentType(MediaType.APPLICATION_PROBLEM_JSON);
    }

    // --- helpers --------------------------------------------------------------

    /** A voter is their cookie. Any well-formed token will do, as with the ones the server issues. */
    record Voter(String token) {

        private static final SecureRandom RANDOM = new SecureRandom();

        static Voter random() {
            var bytes = new byte[32];
            RANDOM.nextBytes(bytes);
            return new Voter(Base64.getUrlEncoder().withoutPadding().encodeToString(bytes));
        }

        Cookie cookie() {
            return new Cookie(VoterIdentity.COOKIE, token);
        }
    }

    static String voterIdOf(Voter voter) {
        return VoterIdentity.voterIdOf(voter.token());
    }

    String createPoll(Voter creator, String votingSystem, String visibility) {
        return createPoll(creator, votingSystem, visibility, "\"showVoterNames\": false");
    }

    /** {@code choices}: more fields of the request, such as {@code "showVoterNames": true}. */
    String createPoll(Voter creator, String votingSystem, String visibility, String choices) {
        var result = post(creator, "/api/polls", """
            {"title": "Lunch?", "votingSystem": "%s", "visibility": "%s", "options": ["Ramen", "Tacos"], %s}
            """.formatted(votingSystem, visibility, choices));
        assertThat(result).hasStatus(HttpStatus.CREATED);
        return JsonPath.read(body(result), "$.id");
    }

    List<String> optionIds(String poll) {
        return JsonPath.read(body(get(alice, "/api/polls/" + poll)), "$.options[*].id");
    }

    MvcTestResult get(Voter voter, String uri) {
        return mvc.get().uri(uri).cookie(voter.cookie()).exchange();
    }

    MvcTestResult post(Voter voter, String uri, String json) {
        return mvc.post().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult put(Voter voter, String uri, String json) {
        return mvc.put().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult patch(Voter voter, String uri, String json) {
        return mvc.patch().uri(uri).cookie(voter.cookie()).contentType(MediaType.APPLICATION_JSON).content(json).exchange();
    }

    MvcTestResult delete(Voter voter, String uri) {
        return mvc.delete().uri(uri).cookie(voter.cookie()).exchange();
    }

    static String body(MvcTestResult result) {
        try {
            return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }
}
