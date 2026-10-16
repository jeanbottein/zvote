# super-vote server

Java 25, Spring Boot 4.1. Spring MVC on virtual threads, Spring Data JDBC,
Flyway, H2 in file mode or PostgreSQL, Spring Modulith. It serves the REST API
and the live-results streams described in [docs/API.md](../../docs/API.md).

## Run and test

```bash
./mvnw spring-boot:run                   # http://localhost:8080
./mvnw test                              # architecture, API and live-stream tests (~15 s, silent when green)
./mvnw test -Dtest=PollApiTest           # one class
./mvnw test -Pcoverage                   # + coverage report: target/site/jacoco/index.html
./mvnw -Pnative native:compile           # a native executable, target/super-vote-server (GraalVM as JAVA_HOME)
./mvnw -PnativeTest test                 # the tests, compiled and run as a native image
./mvnw package && SUPER_VOTE_VOTER_SECRET=<32+ characters> java -jar target/super-vote-server-0.1.0-SNAPSHOT.jar
```

From the repo root, `./dev.sh server` does the same as `spring-boot:run`, with
the database in `<repo>/data`.

## On PostgreSQL

H2 needs nothing installed; production runs on PostgreSQL, and the whole test
suite passes on both. Point the server, or the tests, at an empty database:

```bash
export SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/super_vote?options=-c%20lock_timeout%3D2s'
export SPRING_DATASOURCE_USERNAME=super_vote SPRING_DATASOURCE_PASSWORD=...
./mvnw test                              # every test, on PostgreSQL (start from an empty database)
./mvnw spring-boot:run
```

The lock timeout matches H2's: a ballot waiting longer than that for a poll
being closed or deleted is told to try again, rather than waiting as long as
it takes. Load tests: [docs/PERFORMANCE.md](../../docs/PERFORMANCE.md).

## Configuration

`src/main/resources/application.yml`:

| Setting | Default | Meaning |
|---|---|---|
| `SUPER_VOTE_DATA_DIR` (environment) | `<working dir>/data` | where the H2 file lives; must be absolute |
| `SUPER_VOTE_VOTER_SECRET` (environment) | none: required | keys who owns each ballot and signs invitation links (32+ characters, `openssl rand -base64 48`); `spring-boot:run` sets a development one |
| `super-vote.features.*` | `true`, but `public-polls` | public polls (off until accounts), unlisted polls, approval voting, majority judgment |
| `super-vote.limits.max-options` | `20` | options per poll |
| `super-vote.limits.max-title-length` | `200` | characters (500 at most: the column) |
| `super-vote.limits.max-option-length` | `100` | characters (500 at most) |
| `super-vote.limits.max-voter-name-length` | `40` | characters (100 at most), for names on invitations too |
| `super-vote.limits.max-invitations` | `1000` | per poll; links are signed, not stored, so any number costs the same |
| `super-vote.limits.poll-lifetime-days` | `30` | days before a poll is deleted, with its ballots (1 at least) |
| `super-vote.retention-cron` | `0 * * * * *` | when expired polls are deleted, and deleted polls' ballots removed (every minute); `-` turns it off |
| `super-vote.fold-patience` | `250ms` | how long a ballot's answer waits for its ballot to be folded into the tallies |
| `super-vote.rate-limits.polls-per-day` | `20` | polls one network (an IPv4 address, an IPv6 /64) may create in a day |
| `super-vote.rate-limits.wrong-codes-in-a-row` | `5` | wrong join codes in a row before a network is refused codes for a day |
| `super-vote.rate-limits.wrong-codes-per-day` | `20` | the same over a day, right codes in between or not |
| `server.forward-headers-strategy` | `native` | the client's address and scheme from `X-Forwarded-For` and `-Proto`, believed from a private address only (the reverse proxy) |

Features and limits are advertised at `GET /api/server-info` and enforced when
a poll is created; the rate limits are said where they apply (docs/API.md,
"Fair use"). A limit out of range stops the server at startup.

## Layout

```
org.supervote.server
├── polls/      the question: Poll, PollOption, PollService (every poll rule),
│               InvitationService (who may vote)
├── ballots/    ballots (BallotBoxService), tallies (TallyService), Mention
├── api/        controllers; the services that join polls and ballots (BallotService,
│               PollViewService, PollCreationService), BallotFormat, TallyFolding,
│               PollRetention; DTOs, errors
├── identity/   the voter cookie
├── live/       PollStream: server-sent events
├── ratelimit/  what one network may do in a day: PollQuota, WrongCodes, Network
└── common/     SuperVoteProperties, InvalidRequestException
```

Each package is a Spring Modulith module: its `package-info.java` says which
modules it may use, and `ArchitectureTest` verifies it.
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) explains the boundaries.

## Schema changes

Nothing is deployed yet: change `src/main/resources/db/migration/V1__init.sql`
itself, and delete your development database (`rm -rf data`, server
stopped). From the first deployment on, add migrations (`V2__...sql`). Keep the
SQL portable to PostgreSQL: `GENERATED BY DEFAULT AS IDENTITY`, not
`AUTO_INCREMENT`; singular, unquoted table names; no `@Table` on entities.
