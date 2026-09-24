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

Next phases (in order): accounts and social sign-in, installable web app,
Android through Capacitor, deployment on PostgreSQL. See `docs/ROADMAP.md`
before designing anything in those areas.

## Commands

```bash
./dev.sh               # server :8080 + web app :5173 (proxies /api to :8080)
./dev.sh server|client # one half
./dev.sh test          # everything CI should run
```

Server (`servers/java`, Java 21, Maven wrapper; Maven itself is not needed):

```bash
./mvnw test                         # ArchitectureTest, PollApiTest, PollEventsTest, MentionTest
./mvnw test -Dtest=PollApiTest      # one class
./mvnw spring-boot:run
```

Web app (`clients/web`, Node 20.19+; 24 LTS pinned):

```bash
npm run dev          # Vite on :5173
npm test             # Vitest (jsdom)
npx vitest run src/polls
npm run lint         # ESLint 10 flat config, incl. react-hooks 7 (React Compiler rules)
npm run typecheck    # tsc
npm run build        # typecheck + production bundle
```

## Architecture

Read `docs/ARCHITECTURE.md` for the reasoning; the essentials:

**Server**: packages under `org.zvote.server`: `polls` (the question; every
poll rule is in `PollService`), `ballots.approval` and `ballots.judgment` (one
per voting system), `api` (controllers, `PollViewService`, DTOs, error mapping;
the only package that knows both polls and ballots), `identity` (voter
cookie), `live` (`PollStream`, server-sent events), `common` (config, the
invalid-request exception). `ArchitectureTest` fails the build if polls depend
on ballots, a voting system on the other, anything but `api` on `api`,
`live`/`identity` on the domain, anything but a `*Service` on a `*Repository`,
if a DTO or entity is not a record, or if anything imports Reactor.

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
- **Protected files, kept unchanged on purpose**:
  `features/VotingSystem/MajorityJudgment/MajorityJudgmentResultsGraph.tsx`,
  `utils/majorityJudgment.ts`, `utils/majorityJudgment.test.ts`, and the
  results rules of `majority-judgment.css`. Adapt around them
  (`MajorityJudgmentResults.tsx`, `style.css`). Changing how results are
  ranked is the owner's call: see "Questions for the owner" in the roadmap.
- **Ranking stays in the client.** The server sends seven counts per option,
  never a ranking.
- **Every fetch sends credentials**, and so does `EventSource`: identity is an
  HttpOnly cookie. Without it, every request is a new voter, silently.
- **Visibility is enforced in `PollService`.** Nothing else reads the poll
  repositories.
- **Ballot writes are `PUT` and wholesale** (delete, then insert). An empty
  ballot withdraws.

## Traps already paid for

- **H2 identifier case.** An explicit `@Table("poll")` is a quoted lowercase
  identifier while derived columns are unquoted (upper case in H2): tables and
  columns stop agreeing. Singular, unquoted table names, no `@Table`.
  `DATABASE_TO_LOWER` and `MODE=PostgreSQL` both make it worse.
- **Derived `deleteBy...` loads rows and deletes them one by one** (and throws
  "expected 1, actual 3"). Use `@Modifying @Query("DELETE ...")`.
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
- **Browser tests**: a poll page keeps its event stream open, so "network
  idle" never comes. Wait for an element instead.
- **The GMJ test file uses Jest-style globals** and value-imports types:
  Vitest runs with `globals: true`, and `verbatimModuleSyntax` stays off.
- **Toasts sit at the top**, under the header. At the bottom they covered the
  delete confirmation on phones.
- **Readiness probe**: `/actuator/health`, not an API route.
