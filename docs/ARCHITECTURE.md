# zvote architecture

One Java server and one web client. The server stores polls and ballots and
counts them; the client shows them, lets people vote, and ranks the results.
The guiding rule is to keep the design as small as the problem allows: every
layer below exists because something needed it.

```
 phone / desktop browser
 ┌──────────────────────────────┐
 │ React client (clients/web)   │  ranks the results (GMJ) and draws them
 └──────────────┬───────────────┘
                │ same origin: JSON over HTTP, and one event stream per open poll
 ┌──────────────┴───────────────┐
 │ Spring Boot server           │  rules, identity, tallies, live pushes
 │ (servers/java)               │
 └──────────────┬───────────────┘
                │ JDBC
 ┌──────────────┴───────────────┐
 │ H2 file (data/zvote.mv.db)   │  PostgreSQL when deployed
 └──────────────────────────────┘
```

In development the Vite dev server serves the client on `:5173` and forwards
`/api` to the Java server on `:8080`, so the browser only ever talks to one
origin: cookies and event streams need no CORS.

## Vocabulary

A **poll** is the question being decided. A **ballot** is one voter's answer to
it. "Vote" is ambiguous between the two and is not used as a noun in the code.
A poll's **id** is its share token.

## Server

Java 21, Spring Boot 4.1: Spring MVC on virtual threads, Spring Data JDBC,
Flyway, H2 in file mode. About a thousand lines, in six packages under
`org.zvote.server`:

| Package | Knows about | Holds |
|---|---|---|
| `polls` | nothing else | `Poll`, `PollOption`, `PollService`: every rule about polls |
| `ballots.approval` | nothing else | approval ballots and their tallies |
| `ballots.judgment` | nothing else | majority judgment ballots, `Mention`, tallies |
| `api` | everything | controllers, `PollViewService`, DTOs, error mapping |
| `identity` | nothing else | the voter cookie and `VoterIdentityFilter` |
| `live` | nothing else | `PollStream`: server-sent events |
| `common` | nothing else | `ZVoteProperties`, `InvalidRequestException` |

`ArchitectureTest` (ArchUnit) fails the build if these boundaries are crossed:
polls ignore voting systems, the two voting systems ignore each other, only
`api` knows about HTTP, `live` and `identity` know nothing about the domain,
repositories are only used by services, data classes are records, and nothing
imports Reactor.

### Casting a ballot, step by step

1. `VoterIdentityFilter` reads the `zvote_voter` cookie (issuing one if
   needed) and puts the voter id on the request.
2. `BallotController` asks `PollService.findOpen(id)` for the poll (404 if it
   does not exist, 409 if it is closed), checks that the ballot has the right
   shape and only this poll's option ids, and hands it to the voting system's
   service.
3. That service replaces the voter's ballot in one transaction: delete, then
   insert.
4. `PollStream.changed(...)` is told the poll moved. The caller gets the fresh
   `PollView` straight away; watchers get an update a moment later.

### Identity

Anonymous first: a friend who opens a share link can vote at once. The cookie
holds 256 random bits; the database holds only `base64url(SHA-256(token))`, so
a copy of the database is not enough to act as a voter. The cookie is
`HttpOnly` (scripts cannot read it) and `SameSite=Lax` (other sites cannot send
it with a `POST`, `PUT`, `PATCH` or `DELETE`), and no CORS is enabled, which is
what protects against cross-site request forgery.

Accounts will plug in at the same place: the filter will resolve a signed-in
account first and the anonymous token second (see [ROADMAP.md](ROADMAP.md)).

### Tallies

Counts are never stored. One `GROUP BY` per poll derives them from the ballot
rows, so there is no second source of truth to keep in sync. The server sends
counts, not rankings: majority judgment is ranked by the client
(`utils/majorityJudgment.ts`). An option's majority mention is the best mention
that more than half of the voters give it or better; with an even number of
ballots that is the lower of the two middle mentions, as in Balinski and
Laraki's definition. Ties between equal majority mentions are broken by the
GMJ score. Missing grades
on a majority judgment ballot are stored as `Bad`, the method's convention for
"no opinion", so that every option's median is taken over the same voters.

### Live updates

`GET /api/polls/{id}/events` is a server-sent event stream. SSE is one-way,
which is all a results view needs, needs no handshake protocol, and browsers
reconnect by themselves. Streams are cheap because request threads are
virtual.

`PollStream` keeps the watchers of each poll in memory and:

- **coalesces**: however many ballots arrive in a burst, watchers get one
  update per 200 ms window, computed once, after the burst, off the voter's
  request thread;
- **orders**: every write to a poll's watchers happens under that poll's lock,
  so a slow flush can never overtake a newer one;
- **starts with the current state**, so reconnecting clients are correct at
  once;
- sends a **heartbeat** every 20 s (the only way to notice that a phone went
  away, and it keeps proxies from closing quiet streams), and ends streams
  after 30 minutes so that dead connections cannot pile up;
- **closes every stream when shutdown begins**. Graceful shutdown waits for
  open requests, and a stream never finishes on its own: without this, any
  open results page delayed every restart by 30 seconds.

This works on one server. A second instance will need a shared channel
(PostgreSQL `LISTEN/NOTIFY` or Redis) to relay `changed` calls between nodes.

### Persistence

Flyway owns the schema (`src/main/resources/db/migration`). The SQL is portable
(`GENERATED BY DEFAULT AS IDENTITY`, `TIMESTAMP WITH TIME ZONE`) so that it
runs unchanged on PostgreSQL. Table names are singular and unquoted and entities
have no `@Table`: see the note at the top of `V1__init.sql`. Deleting a poll
deletes its options and ballots (`ON DELETE CASCADE`). `V1` has never been
released and was rewritten in place; from the first deployment on, only add
migrations.

### Errors

`ApiExceptionHandler` turns domain exceptions into RFC 9457 problem documents
whose `detail` can be shown to people as is: `InvalidRequestException` → 400,
`NotPollCreatorException` → 403, `PollNotFoundException` → 404,
`PollClosedException` and simultaneous ballots → 409. Spring MVC's own errors
use the same format.

### Tests

- `ArchitectureTest`: the boundaries above.
- `PollApiTest`: the HTTP contract through MockMvc, on an in-memory H2
  migrated by Flyway: creation and validation, finding polls, both voting
  systems, revising and withdrawing, closing, deleting, identity.
- `PollEventsTest`: the live stream over a real socket: first event,
  coalescing, closing, deletion, unknown poll.

## Client

React 19 and TypeScript, built by Vite, tested with Vitest and Testing Library,
styled with plain CSS. No state library, no CSS framework: a few hooks and
tokens do the job.

```
src/
  index.tsx            entry: applies saved preferences, renders <App>
  app/                 the shell: routes, header, settings, not-found page
  api/                 the only code that talks to the server (fetch + EventSource)
  polls/               the screens (home, new poll, poll) and their hooks
  features/VotingSystem/
    MajorityJudgment/  ballots (colour scale, dropdowns), results, mention names
    Approval/          ballot, results, ranking
  preferences/         theme, palette, ballot style, live/envelope submission
  ui/                  small shared pieces: dialog, segmented control, toasts, icons
  utils/               majorityJudgment.ts: the GMJ ranking math
  style.css            tokens, layout, shared components
```

The voting-system folders are presentational: they take options and a ballot
and call back with a new ballot. The `polls` screens connect them to the API,
the same way `api` composes polls and ballots on the server.

### Routes

| Path | Screen |
|---|---|
| `/` | your polls and other people's public polls |
| `/new` | create a poll |
| `/p/:id` | a poll: your ballot, the live results, and the creator's controls |

A poll's page address is its share link.

### Data flow on a poll page

`usePoll(id)` loads the poll, then opens its event stream. Loading first
guarantees that the stream's first event is at least as recent as what was
loaded, so an update can neither be missed nor rolled back. Updates are merged
into the loaded poll; they carry nothing about the voter, so `isMine` and
`myBallot` survive. After a ballot, the server's answer replaces the poll.

`useBallot` holds the ballot being filled in:

- **Live** (the default): each change is cast at once. Changes made while one
  is on its way are not all sent: the latest one is cast next, so the server
  always ends with the voter's last choice. Until the server answers, the page
  shows what the voter chose; if casting fails it falls back to what the server
  holds, and a toast explains why.
- **Envelope**: changes stay on the page until the voter submits them.

### The results visualisation

`MajorityJudgmentResultsGraph.tsx`, `utils/majorityJudgment.ts` (and its tests)
and the mention ramp in `majority-judgment.css` are the reference visualisation
of majority judgment results. They are kept unchanged on purpose. Adapting them
happens around them: `MajorityJudgmentResults.tsx` converts the API's options to
their input, and small-screen adjustments live in `style.css`.

### Styling

Mobile first: layouts are written for a phone held upright, and wider screens
get more room. Tap targets are at least 44 px, inputs use 16 px text (smaller
makes iOS zoom in), nothing depends on hovering, and the header and dialogs
respect the notch and home-bar safe areas. On phones, dialogs open as sheets
from the bottom.

Colours are CSS custom properties. The dark set applies when the device prefers
dark, or when the voter picks a theme in Settings (`data-theme` on `<html>`).
The seven mention colours are defined once, in
`features/VotingSystem/MajorityJudgment/mentions.css`, for the results and the
ballots alike: anything showing a mention carries `data-judgment` or
`data-mention` and paints itself with `--mention`. The grey palette
(`data-colorblind` on `<body>`) is seven greys evenly spaced in perceived
lightness, lighter is better, readable whatever colours a person can tell apart.

### Tests

Vitest runs in jsdom: the GMJ math, the API client (with fake `fetch` and
`EventSource`), the ballot state machine, the form rules, the ballots, and the
poll and new-poll screens with the API mocked. The end-to-end behaviour (two
voters, live updates, phone and desktop layouts) was checked in a real browser;
automating that in CI with Playwright is on the roadmap.

## Decisions

| Decision | Why |
|---|---|
| One backend (Java) | SpacetimeDB is under the Business Source License, which forbids the open-source goal; the dual-backend layer went with it. |
| Spring MVC on virtual threads, not WebFlux | Blocking code that reads top to bottom, with the concurrency of async. `ArchitectureTest` keeps Reactor out. |
| Spring Data JDBC, not JPA | No lazy loading or dirty checking, and it maps Java records, which JPA cannot. |
| REST + server-sent events, not GraphQL or WebSockets | Plain HTTP and one-way pushes cover every need, with nothing to negotiate. |
| H2 in file mode | No database to install or configure; the data file moves between machines. PostgreSQL arrives with deployment. |
| Tallies derived, never stored | One source of truth. |
| Ranking in the client | Majority judgment math lives in one tested module, next to the visualisation. |
| `PUT` for ballots | One ballot per voter per poll; cast, revise and withdraw are one operation, and retries are safe. |
| Share token as the only id | One identifier, unguessable, that doubles as the unlisted-poll secret. |
| Hashed voter ids | The database alone cannot be used to act as someone. |
| Public and unlisted only | "Private" means "only people I choose", which needs accounts. It comes back with them. |
| No client state library | Two data hooks and one ballot hook are all the state there is. |

## Known limits

- **Anonymous identity is per browser.** Clearing cookies, or another browser,
  is another voter. Fine among friends; not for decisions that must resist
  ballot stuffing, which need accounts.
- **Live updates are single-node** (see above).
- **Lists are capped** (50 public polls, 100 of your own) and not paginated.
