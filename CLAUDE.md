# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

## Project

zvote is an open-source, live voting platform: **majority judgment** (with the
graduated GMJ tie-break) and **approval voting**. One Java server (REST +
server-sent events) and one React web app, mobile first. Nothing is in
production, so bold refactors are welcome, but the owner's criteria are clean
architecture, YAGNI, industry standards and the lowest cognitive complexity
that works. When those pull apart, pick YAGNI and simplicity: no ports and
adapters, no interface per implementation, no mapper per boundary.

The MVP is for groups deciding together: private polls shared by link or join
code, optional voter names shown as a cloud, results live, delayed or at close
(the creator's choice), ballots unlinkable at rest, polls deleted after 30 days,
public polls off until accounts. Next phases (in order): deployment on
OVHcloud with PostgreSQL, accounts and social sign-in, installable web app,
Android through Capacitor. See `docs/ROADMAP.md` before designing anything in
those areas.

## Commands

```bash
./dev.sh               # server :8080 + web app :5173 (proxies /api to :8080)
./dev.sh server|client # one half
./dev.sh test          # everything CI should run
```

Server (`servers/java`, Java 25, Maven wrapper; Maven itself is not needed):

```bash
./mvnw test                         # silent when green; see src/test for the classes
./mvnw test -Dtest=PollApiTest      # one class
./mvnw test -Pcoverage              # + JaCoCo report: target/site/jacoco/index.html
./mvnw spring-boot:run
./mvnw -Pnative native:compile      # native image (GraalVM as JAVA_HOME), ~10 min
./mvnw -PnativeTest test            # the tests as a native image; perf/ benchmarks: docs/PERFORMANCE.md
```

Web app (`clients/web`, Node 20.19+; 24 LTS pinned):

```bash
npm run dev          # Vite on :5173
npm test             # Vitest (jsdom)
npx vitest run src/polls
npm run coverage     # + V8 coverage report: coverage/index.html
npm run lint         # ESLint 10 flat config, incl. react-hooks 7 (React Compiler rules)
npm run typecheck    # tsc
npm run build        # typecheck + production bundle
```

## Architecture

Read `docs/ARCHITECTURE.md` for the reasoning; the essentials:

**Server**: one Spring Modulith module per package under `org.zvote.server`:
`polls` (the question; every poll rule is in `PollService`), `approval` and
`judgment` (one per voting system), `api` (controllers, `PollViewService`,
DTOs, error mapping; the only module that knows both polls and ballots),
`identity` (voter cookie), `live` (`PollStream`, server-sent events), `common`
(config, the invalid-request exception). Each module's `package-info.java`
declares the modules it may use (`@ApplicationModule(allowedDependencies)`);
its API is its root package, and its sub-packages (`api.dto`) are its own.
`ArchitectureTest` fails the build on an undeclared dependency, a cycle or a
reach into another module's sub-packages (Spring Modulith), and if a
repository is public or used by anything but a `*Service`, a DTO or entity is
not a record, or anything imports Reactor (ArchUnit).

**Client**: `src/api` is the only code that talks to the server.
`src/polls` holds the screens and their hooks (`usePoll`: load, then watch;
`useBallot`: live or envelope ballot). `src/features/VotingSystem/*` holds
presentational ballots and results per voting system. `src/ui` holds shared
pieces, `src/preferences` the voter's settings, `src/app` the shell and routes
(`/`, `/new`, `/p/:id`).

**Contract**: `docs/API.md`. Mirror every DTO change in
`clients/web/src/api/types.ts`. A poll's `id` is its share token, the only id
that leaves the server. Errors are RFC 9457 problem documents whose `detail` is
shown to people as is: write it as a sentence for them.

## Rules that are easy to break

- **Vocabulary**: *poll* = the question, *ballot* = one voter's answer. Never
  "vote" as a noun in code.
- **The seven mentions** are spelled `Bad, Inadequate, Passable, Fair, Good,
  VeryGood, Excellent` everywhere: `Mention.wireName()`, the API, the TS types,
  the CSS `data-judgment` / `data-mention` selectors. Rename one, rename all.
  Their colours (both palettes) are defined once, in `mentions.css`.
- **The results graph and the ranking math are the owner's reference**:
  `features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph.tsx`
  with `majority-judgment.css`, and `utils/majorityJudgment.ts` with its tests.
  Change them only when the owner asks (both were revised at his request on
  2026-09-24). How results are ranked is his call: see "Questions for the
  owner" in the roadmap. Decided so far: with an even number of ballots the
  majority mention is the lower of the two middle mentions (more than half the
  voters, not half); ties on the majority mention are broken by the GMJ score
  alone, computed from the counts so that equal scores stay equal, and what is
  still tied shows ex aequo.
- **Ranking stays in the client.** The server sends seven counts per option,
  never a ranking.
- **Every fetch sends credentials**, and so does `EventSource`: identity is an
  HttpOnly cookie. Without it, every request is a new voter, silently. (The
  dev ballot feeder leaves it out on purpose: `castBallotAsNewVoter`.)
- **Visibility is enforced in `PollService`.** Nothing else can read the poll
  repositories: they are package-private.
- **Ballot writes are `PUT` and wholesale** (delete, then insert). An empty
  ballot withdraws.

## Traps already paid for

- **H2 identifier case.** An explicit `@Table("poll")` is a quoted lowercase
  identifier while derived columns are unquoted (upper case in H2): tables and
  columns stop agreeing. Singular, unquoted table names, no `@Table`.
  `DATABASE_TO_LOWER` and `MODE=PostgreSQL` both make it worse.
- **Derived `deleteBy...` loads rows and deletes them one by one** (and throws
  "expected 1, actual 3"). Use `@Modifying @Query("DELETE ...")`.
- **`PollOption` is its own aggregate on purpose.** Spring Data JDBC deletes
  and re-inserts an aggregate's lists on every save: as a list inside `Poll`,
  closing a poll would renumber its options and cascade-delete its ballots.
- **A view is composed from several queries in one snapshot**
  (`PollViewService`: read-only, repeatable read). At the default isolation, a
  ballot landing between the tallies and the ballot count made them disagree.
- **Flyway 12** still has H2 support in `flyway-core`; PostgreSQL needs
  `flyway-database-postgresql`.
- **Spring Boot 4 is modular.** Starters are `spring-boot-starter-webmvc`,
  `-data-jdbc`, `-flyway`, `-webmvc-test`; `@AutoConfigureMockMvc` lives in
  `org.springframework.boot.webmvc.test.autoconfigure`; JSON is Jackson 3.
- **Server-sent events and shutdown.** Graceful shutdown waits for open
  requests, and a stream never ends on its own: `PollStream` completes every
  stream on `ContextClosedEvent`. Without that, any open results page delays
  shutdown by 30 seconds.
- **An `SseEventBuilder` can only be built once**: create one per recipient.
- **A module that needs another one says so** in its `package-info.java`
  (`allowedDependencies`), or `ArchitectureTest` fails. A new module is a new
  package under `org.zvote.server`; what it shares goes in its root package.
- **`PollStream` runs on Spring Boot's task scheduler**, which Boot provides
  only because of `@EnableScheduling` on `ZVoteServerApplication`; with
  virtual threads enabled, each flush and heartbeat gets a virtual thread.
- **Maven 3.9 on JDK 24+** warns that its own Guice calls `sun.misc.Unsafe`:
  `servers/java/.mvn/jvm.config` allows it (that file cannot hold comments).
- **Casting holds a shared lock on the poll** (`PollService.findOpen`, which
  demands a transaction: `BallotService.cast`). Without it, a ballot could be
  counted after the poll closed, or reported counted on a poll being deleted.
  H2 only knows `FOR UPDATE`, so there ballots on one poll queue; PostgreSQL
  gets `FOR SHARE`.
- **A new watcher's first state is computed after it joins**, under its poll's
  lock (`PollStream.join`). Computed before, a ballot landing in between was
  lost until the next one.
- **`EventSource` gives up for good when the server answers an error**, as the
  dev proxy does while the server restarts; it only retries network errors.
  `usePoll` then loads and watches the poll again (`PollWatcher.onLost`).
- **Browser tests**: a poll page keeps its event stream open, so "network
  idle" never comes. Wait for an element instead.
- **The GMJ test file uses Jest-style globals** and value-imports types:
  Vitest runs with `globals: true`, and `verbatimModuleSyntax` stays off.
- **Dialogs hold their content only while open**, so that a live page does not
  re-render what nobody sees (the share dialog's QR code). jsdom has no
  `showModal()`: `src/test/setup.ts` stands in for it.
- **A native image only keeps the reflection known at build time.** Two bugs
  showed only there: Spring converting H2's `OffsetDateTime` to `Instant` by
  reflection (`PersistenceConfiguration` now declares the converter), and the
  live stream's `PollUpdate`, which no controller signature mentions
  (`@RegisterReflectionForBinding` on the endpoint). A type serialized outside
  a controller's signature needs the same; `-PnativeTest` finds what is missed.
  Tests that cannot run natively (class-file scanning, Mockito) carry
  `@DisabledInNativeImage`.
- **Server tests are silent when green** (`logback-test.xml`,
  `application-test.yml`), and Mockito is set to need no Java agent
  (`src/test/resources/mockito-extensions`): mocking a final class or a static
  method would need the inline mock maker back.
- **Toasts sit at the top**, under the header. At the bottom they covered the
  delete confirmation on phones.
- **Readiness probe**: `/actuator/health`, not an API route.
- **Jackson 3 fails on a missing primitive** (`FAIL_ON_NULL_FOR_PRIMITIVES` is
  on): an optional request field is a `Boolean`, not a `boolean`, or leaving
  it out answers "could not be read".
- **Scheduled jobs are off in tests** (`zvote.retention-cron: "-"`). Running
  at startup, `PollRetention` raced Mockito's stubbing in
  `UnexpectedFailureTest` and stole the stub. Tests call the job themselves.
- **Voter names are per poll and go with the ballot**: a `PUT` without
  `voterName` makes the voter anonymous, and withdrawing forgets the name.
  They never say who chose what: names and ballots are keyed apart
  (`Voter.nameKey` / `Voter.ballotKey`, HMACs per poll under
  `ZVOTE_VOTER_SECRET`). Never store them under the same key or the voter id,
  never add a timestamp to either, and keep the name cloud alphabetical.
- **The server will not start without `ZVOTE_VOTER_SECRET`** (32+
  characters). `spring-boot:run` and `./dev.sh` get a development one from
  `pom.xml`, tests from `application-test.yml`; `java -jar`, a native image
  and `perf/bench.py` need it set.
- **Results kept back are hidden from everyone**, the creator included:
  `PollViewService` leaves the tallies null unless `Poll.showsResults`
  (mirrored by `polls/showsResults.ts`). Anything new that shows counts must
  ask it too.
- **A counted ballot starts hidden** (`BallotFrame`), on every screen, so
  the voter's screen is no receipt. Only opening it or withdrawing shows it.
- **Closing is for good** (`PollService.setClosed`): `{"closed": false}` on a
  closed poll answers `409`. Reopening would let a creator peek at hidden
  results and then watch the next ballots move them.
