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
code, or by invitation (one link per voter, sent by the creator), optional
voter names shown as a cloud, results live, delayed or at close (the
creator's choice), ballots unlinkable at rest, polls deleted after 30 days,
public polls off until accounts. Under it, one poll must scale to billions of
ballots (docs/ROADMAP.md, "Scale"): never let a request's cost grow with a
poll's size. Next phases (in order): deployment on
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
SPRING_DATASOURCE_URL='jdbc:postgresql://localhost:5432/zvote_test?options=-c%20lock_timeout%3D2s' \
  SPRING_DATASOURCE_USERNAME=... ./mvnw test   # the same tests on PostgreSQL, on an empty database
./mvnw spring-boot:run
./mvnw -Pnative native:compile      # native image (GraalVM as JAVA_HOME), ~10 min
./mvnw -PnativeTest test            # the tests as a native image (~20 min); perf/: docs/PERFORMANCE.md
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
`polls` (the question; every poll rule is in `PollService`, who may vote in
`InvitationService`), `ballots` (one
row per ballot, one byte per option, for every voting system; the tallies,
folded from a change log; `Mention`), `api` (controllers, `PollViewService`,
DTOs, error mapping; the only module that knows both polls and ballots, and
what a ballot's bytes mean: `BallotFormat`),
`identity` (voter cookie), `live` (`PollStream`, server-sent events), `common`
(config, the server's secret `VoterSecret`, the invalid-request exception). Each module's `package-info.java`
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
(`/`, `/new`, `/p/:id`, `/about`).

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
  with `majority-judgment.css`, and `api/Ranking.java` with `RankingTest`.
  Change them only when the owner asks (the graph was revised at his request
  on 2026-09-24; the ranking moved to the server at his request on
  2026-10-09). How results are ranked is his call: see "Questions for the
  owner" in the roadmap. Decided so far: with an even number of ballots the
  majority mention is the lower of the two middle mentions (more than half the
  voters, not half); ties on the majority mention are broken by the GMJ score
  alone, computed from the counts so that equal scores stay equal, and what is
  still tied shows ex aequo.
- **Ranking lives on the server, once.** `api/Ranking.java` derives each
  option's `rank`, `majorityMention` and `score` from the counts, and the
  counts go out beside it so the ranking can be checked. The client renders it
  (`features/VotingSystem/ranked.ts`) and never recomputes it: two
  implementations of the GMJ tie-break is one too many, and an agent reading
  the results has none of its own. A ranking is null exactly when the tallies
  are: a held-back poll's order would say who is winning.
- **Options go out in the poll's own order, never sorted.** That order is what
  a ballot's bytes are positions in. `rank` is how a client orders them.
- **Every fetch sends credentials**, and so does `EventSource`: identity is an
  HttpOnly cookie. Without it, every request is a new voter, silently. (The
  dev ballot feeder leaves it out on purpose: `castBallotAsNewVoter`.)
- **A bearer token beats the cookie, and a bad one is 401.** A client that is
  not a browser sends `Authorization: Bearer <voter token>`, and gets no
  cookie back. A *cookie* the server did not issue is replaced in silence,
  which is right for a browser; a *bearer token* it did not issue answers 401,
  because a client that chose to send a credential must not quietly start
  voting as somebody else. `POST /api/voters` mints and never reveals: it
  always answers a brand new voter, never the caller's own token.
- **A problem's `type` is contract, its `detail` is prose.** Every failure the
  server raises has a `ProblemType`; machine clients branch on it, so adding a
  failure means adding one. `detail` stays the sentence a person reads.
- **`PollView.handover` is a write-once secret.** Only the answer that created
  the poll carries it, and only when the request asked for it. A test pins
  that `GET /api/polls/{id}` never does.
- **Visibility is enforced in `PollService`.** Nothing else can read the poll
  repositories: they are package-private.
- **Ballot writes are `PUT` and wholesale**: the voter's one row is replaced,
  and what changed goes into `ballot_change`. An empty ballot withdraws.
- **A change to a poll goes through `PollChangeService`.** Casting a ballot,
  closing a poll and deleting one each need the change, then the fold, then
  the push to watchers. Controllers and MCP tools both call it, so that none
  of them can do the first and forget the rest (an early MCP tool did).
- **Tallies are stored, never recounted.** Ballots only insert into
  `ballot_change`; `TallyFolding` folds it into `tally` and `ballot_count`
  (`TallyService.fold`). Nothing on the request path may update a counter or
  `GROUP BY` the ballots: that is what made a poll slower with every ballot
  (docs/PERFORMANCE.md, "Ballots at scale"). A poll gets its counters when it
  is created (`PollCreationService`), so polls are created through it.

## Traps already paid for

- **H2 identifier case.** An explicit `@Table("poll")` is a quoted lowercase
  identifier while derived columns are unquoted (upper case in H2): tables and
  columns stop agreeing. Singular, unquoted table names, no `@Table`.
  `DATABASE_TO_LOWER` and `MODE=PostgreSQL` both make it worse.
- **Derived `deleteBy...` loads rows and deletes them one by one** (and throws
  "expected 1, actual 3"). Use `@Modifying @Query("DELETE ...")`.
- **`PollOption` is its own aggregate on purpose.** Spring Data JDBC deletes
  and re-inserts an aggregate's lists on every save: as a list inside `Poll`,
  closing a poll would give its options new ids, which the API exposes.
- **A view is composed from several queries in one snapshot**
  (`PollViewService`: read-only, repeatable read). At the default isolation, a
  fold landing between the tallies and the ballot count made them disagree.
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
  gets `FOR SHARE`, which measured as fast as its advisory locks: no
  PostgreSQL-only lock needed.
- **A new watcher's first state is computed after it joins**, under its poll's
  lock (`PollStream.join`). Computed before, a ballot landing in between was
  lost until the next one.
- **`EventSource` gives up for good when the server answers an error**, as the
  dev proxy does while the server restarts; it only retries network errors.
  `usePoll` then loads and watches the poll again (`PollWatcher.onLost`).
- **Browser tests**: a poll page keeps its event stream open, so "network
  idle" never comes. Wait for an element instead.
- **Vitest runs with `globals: true`** because Testing Library unmounts
  between tests only when it finds a global `afterEach`; without it, one
  test's DOM is still in the next one's queries. (It was also what the old
  Jest-style GMJ test file needed, which is gone.) `verbatimModuleSyntax`
  stays off.
- **Dialogs hold their content only while open**, so that a live page does not
  re-render what nobody sees (the share dialog's QR code). jsdom has no
  `showModal()`: `src/test/setup.ts` stands in for it.
- **A native image only keeps the reflection known at build time.** Two bugs
  showed only there: Spring converting H2's `OffsetDateTime` to `Instant` by
  reflection (`PersistenceConfiguration` now declares the converter), and the
  live stream's `PollUpdate`, which no controller signature mentions
  (`@RegisterReflectionForBinding` on the endpoint). A type serialized outside
  a controller's signature needs the same - an MCP tool's answer as much as a
  stream's payload (`Decision`, on `PollTools`), and a record fails with
  "Record components not available" rather than anything about reflection.
  `-PnativeTest`, or simply running the image, finds what is missed.
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
  They never say who chose what: names, ballots and used invitations are
  keyed apart (`Voter.nameKey` / `ballotKey` / `invitationKey`, HMACs per
  poll under `ZVOTE_VOTER_SECRET`). Never store two of them under the same
  key or the voter id, never add a timestamp to any, and keep the name cloud
  alphabetical.
- **Invitation links are signed, never stored** (`InvitationLinks`: the
  invitation's number and an HMAC of it), and the token never goes in a URL
  the server sees: the link carries it in the fragment
  (`/p/{id}#invitation=...`), and the client sends it in the
  `Zvote-Invitation` header. The first ballot cast with it binds it to that
  browser (`InvitationService.admit`): the creator can read every link, and
  a used one must show them nothing. An invitation has a row only once it is
  named, used or taken back: never read or count a poll's invitations
  beyond a page.
- **The server will not start without `ZVOTE_VOTER_SECRET`** (32+
  characters, `VoterSecret`). It keys voters' records and signs invitation
  links: changing it orphans every ballot and voids every link. `spring-boot:run` and `./dev.sh` get a development one from
  `pom.xml`, tests from `application-test.yml`; `java -jar`, a native image
  and `perf/bench.py` need it set.
- **Results kept back are hidden from everyone**, the creator included:
  `PollViewService` leaves the tallies null unless `Poll.showsResults`, and
  the client tells from those nulls. Anything new that shows counts must go
  through it.
- **A counted ballot starts hidden** (`BallotFrame`), on every screen, so
  the voter's screen is no receipt. Only opening it or withdrawing shows it.
- **Closing is for good** (`PollService.close`): `PATCH` takes only
  `{"closed": true}`. Reopening would let a creator peek at hidden results
  and then watch the next ballots move them.
- **A ballot's bytes are positions and ranks** (`BallotFormat`, pinned by
  `BallotFormatTest`): byte i is option i's `Mention.ordinal()`, or 1 for an
  approval. Never reorder `Mention`, nor a poll's options.
- **Ballots and names have no foreign key to their poll**: a deleted poll's
  can be billions, so `PollRetention` removes them in batches, from
  `poll_removal`, which `PollService` fills in the deleting transaction.
- **Nothing is deployed yet: the schema is one migration**, `V1__init.sql`,
  rewritten in place when it changes. Delete development databases after
  such a change (`rm -rf data`, with `./dev.sh` stopped). From the first
  deployment on, only add migrations.
- **A migration renamed or removed stays in `target/classes`**: `./mvnw test`
  then fails with "Found more than one migration with version N". Delete that
  one file there; a `clean` would pull the classes from under a running
  `./dev.sh`.
- **`-PnativeTest` replays every test id ever run** from
  `target/maven-surefire-plugin-test-ids/`, removed tests included, and stops
  on the first it cannot find ("could not be resolved"). Delete that folder
  after renaming or removing a test.
- **Never interrupt a thread that may be reading H2's file**: H2 closes the
  whole database. `TallyFolding.stop()` lets the current fold finish.
- **A thread must be told it runs before it starts**: `TallyFolding`'s loop
  runs while `folder` is set. Started first and assigned after, the thread
  once ran before the assignment, stopped at once, and the server never
  folded a ballot again (seen once, under load).
- **An AOT build leaves generated classes in `target`**, and the next
  `./mvnw test` reads them. `-PnativeTest` fills `target/test-classes` with
  Spring Data's generated accessors, so after changing an entity the tests
  fail with "No accessor to get property"; `-Pnative` fills `target/classes`
  with `*__BeanDefinitions` and `*Impl__AotRepository`, so `ArchitectureTest`
  reports entities that are not records and a public repository. Neither is
  your code: delete `target/classes`, `target/test-classes` and
  `target/spring-aot`, and never run a native build beside `./mvnw test`.
- **PostgreSQL waits for locks forever unless told**: its URL carries
  `?options=-c%20lock_timeout%3D2s`, and its timeout (SQL state `55P03`),
  which Spring leaves uncategorized, is turned into a 409 in
  `ApiExceptionHandler`.
- **An MCP tool's error text is doubled.** Spring AI builds it as
  `message + lineSeparator + rootCause.message`, and an exception with no
  cause is its own root. The sentence is right, just printed twice; it is not
  worth code to work around.
- **A new voter token is one request away** (`POST /api/voters`), so anything
  that assumed "a voter costs a cookie round-trip" no longer holds. Rate
  limits, keyed by network, are phase 6 (docs/ROADMAP.md).
- **Tests wait for their fold** (`zvote.fold-patience: 10s`), so a ballot's
  answer counts it; in production the wait is 250 ms. The server's tests
  also pass on PostgreSQL: see `servers/java/README.md`.
