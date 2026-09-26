# zvote: handoff

**Updated 2026-09-26.** For whoever picks this up next, human or agent. Read
`CLAUDE.md` first (conventions and traps), then `docs/ARCHITECTURE.md` and
`docs/ROADMAP.md`. This file only says where things stand.

## State

The migration away from SpacetimeDB is complete: one backend, the Java server,
and a web client rebuilt against it, mobile first, on `main`. Phases 0 to 4 of
the roadmap are done, followed by a cleanup pass and a Spring Boot review
(below). **Phase 5, accounts and social sign-in, is next.**

## Cleanup pass (2026-09-26)

Bugs fixed, each with a test that fails without the fix:

- **Live results stopped for good after a server restart.** Browsers only
  reconnect an event stream after a network error; the dev proxy's error
  answer while the server restarted made `EventSource` give up, and the page
  showed "Reconnecting…" forever. `usePoll` now loads and watches the poll
  again every 5 s; a poll deleted meanwhile shows as deleted.
- **A watcher joining as a ballot landed could miss it** until the next one:
  its first state was computed before it joined. `PollStream.join` computes it
  after, under the poll's lock, and reads the poll afresh (a poll closed in
  between showed as open).
- **Withdrawing could overtake a live ballot still on its way**, leaving it
  counted. Withdrawals now take their turn in the live queue (and no longer
  show "Submitting…" in envelope mode).
- The dev ballot feeder talked to the server outside `src/api` and stayed
  stuck on "Casting…" after a failure; a non-API failure to load a poll showed
  a raw error string; the results download revoked its file before some
  browsers read it; timestamps in create and close answers carried
  nanoseconds that the database rounds away (on Linux).

Cleaner or faster:

- Repositories and ballot rows are package-private: "only `PollService` reads
  the poll repositories" is now checked by the compiler, and ArchitectureTest
  keeps it so.
- Dialogs hold their content only while open: every live update used to
  re-render the closed share dialog, QR code drawing included (twice right
  after creating a poll, which shows two share buttons).
- Server tests print nothing when green, and no longer load Java agents
  dynamically (a future JDK will refuse that). `./dev.sh test` builds the
  production bundle too.
- Coverage on demand: `./mvnw test -Pcoverage`, `npm run coverage`.

## Spring Boot review (2026-09-26, later)

A review against Spring Boot idioms, in the spirit of a Spring advocate
("let Boot do it"), and the refactoring it called for:

- **Java 25**, the current LTS (was 21, while this machine ran an unsupported
  23). Since Java 24, virtual threads no longer pin their carrier thread in
  `synchronized` code, which H2 and JDBC are full of. Maven wrapper 3.9.16.
  **Install a JDK 25 before the next `./dev.sh`** (`mise install`, or any JDK
  25); `dev.sh` says so if the JDK is older.
- **Spring Modulith**: each package under `org.zvote.server` is a module whose
  `package-info.java` declares the modules it may use; `ArchitectureTest`
  verifies them (a planted leak from `live` into `polls`, or between the two
  voting systems, fails with the exact edge). `ballots.approval` and
  `ballots.judgment` became the top-level `approval` and `judgment` modules,
  and `CreatePollRequest` moved to the root of `polls`, its module API. Only
  `spring-modulith-api` (annotations) ships in the jar.
- **Boot does the threading**: `PollStream` uses the `TaskScheduler` Boot
  provides (virtual threads, lifecycle included) and `@Scheduled` for the
  heartbeat, instead of its own executor and platform timer thread.
- **One snapshot per view**: `PollViewService` reads a poll's options,
  tallies and ballot count in one read-only, repeatable-read transaction. At
  the default isolation (read committed, in H2 as in PostgreSQL) a ballot
  landing between two of those queries made them disagree; a withdrawal
  could show an approval at 200 % until the next update.
- `PollOption` now says why it is an aggregate of its own: Spring Data JDBC
  rewrites an aggregate's lists on every save, which would renumber options
  and cascade-delete ballots each time a poll closes.
- **Less to read**: no `@Repository` on Spring Data interfaces, no settings
  that repeat Boot's defaults (port 8080, health exposure), no DEBUG logging
  in the main configuration, ArchUnit's core artifact instead of its JUnit
  engine, and 4 architecture tests instead of 10 rules.
- Checked on JDK 25 against a real server: live updates, recovery after a
  restart, withdrawals, the heartbeat, and a 0.15 s shutdown with a watcher
  connected.

Considered and left out: domain events between modules (one listener, the
live stream, would gain indirection and no decoupling); GraalVM native images
(no GraalVM here to verify them; phase 8); Spring Security for identity
(phase 5).

## Verified

- **Server**: 71 tests (56 before the cleanup; the module rules are now one
  Modulith check), about 15 s. Coverage 98 % of instructions,
  88 % of branches. New: the stream's rules without a server (`PollStreamTest`),
  simultaneous ballots from one voter (only 200s and 409s, one ballot kept;
  about half get 409), a server offering less, every action on an unknown poll,
  Spring's own errors as problem documents, invalid approval ids.
- **Client**: 140 tests (was 92). Coverage 95 % of statements, 93 % of
  branches (was 76 % and 71 %): every screen, the app shell and settings, the
  approval components, preferences, toasts, the results export, the share
  dialog, the lost-stream recovery.
- **End to end** in headless Chrome against a separate server and database:
  stopping the server makes Chrome give up on the stream (readyState 2 after
  the proxy's error), and the page catches up 0.6 s after the server is back;
  a live ballot followed at once by a withdrawal, with a slow network, leaves
  no ballot; dialogs checked on a phone and a desktop, light and dark. The
  production bundle still holds no dev tool.

Earlier checks (2026-09-24) still stand: 23 end-to-end checks with two voters,
concurrency by hand, shutdown with a watcher connected in 0.08 s.

## Decisions made so far (reversible)

- Spring Boot 3.4 → 4.1 (3.x is out of open-source support). Java 21 → 25.
- Client: React 19, Vite 8, TypeScript 6, Vitest (replacing Jest), ESLint 10,
  react-router 7. Node 24 pinned; everything also runs on Node 20.19.
- `PRIVATE` visibility removed until accounts exist ("only people I choose"
  cannot be implemented without them).
- Closing and reopening polls; RFC 9457 errors; hashed voter ids; poll limits
  enforced from configuration; ballots must match their poll (400 otherwise).
- The `liveBallot` / `envelopeBallot` server flags became the voter's
  preference, in Settings.
- Toasts at the top of the screen: at the bottom they covered the delete
  confirmation on phones.
- Not done in the cleanup, on purpose: `light-dark()` would remove the
  duplicated dark tokens in `style.css`, but breaks every colour on iOS 16
  (the last version for the iPhone 8 and X); pre-serialising live updates once
  per flush, instead of once per watcher, only pays off with thousands of
  watchers on one poll.

## Open questions for the owner

See the end of `docs/ROADMAP.md`: "unrated means Bad", results visible before
voting, and exact ties in the GMJ score (a rounding bug in the ranking math,
with a one-line fix, left for the owner to accept since that file is his
reference).
