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
A poll's **id** is its share token; its **join code** is a six-character
stand-in to type on a phone (`K7M-4QX`).

## Server

Java 25, Spring Boot 4.1: Spring MVC on virtual threads, Spring Data JDBC,
Flyway, H2 in file mode, Spring Modulith. About a thousand lines, in seven
modules, one per package under `org.zvote.server`:

| Module | Uses | Holds |
|---|---|---|
| `polls` | `common` | `Poll`, `PollOption`, `PollService`: every rule about polls |
| `approval` | nothing | approval ballots and their tallies |
| `judgment` | nothing | majority judgment ballots, `Mention`, tallies |
| `api` | everything | controllers, `PollViewService`, DTOs, error mapping |
| `identity` | nothing | the voter cookie and `VoterIdentityFilter` |
| `live` | nothing | `PollStream`: server-sent events |
| `common` | nothing | `ZVoteProperties`, `InvalidRequestException` |

Each module says what it is, and which modules it may use, in its
`package-info.java` (`@ApplicationModule`). Its API is its root package; its
sub-packages (`api.dto`) are its own. `ArchitectureTest` has Spring Modulith
verify it all: polls ignore voting systems, the two voting systems ignore each
other, nothing depends on `api`, `live` and `identity` know nothing about the
domain, and there are no cycles. ArchUnit adds what a module declaration
cannot say: repositories are package-private (so only the service beside one
can use it), data classes are records, and nothing imports Reactor.

### Casting a ballot, step by step

1. `VoterIdentityFilter` reads the `zvote_voter` cookie (issuing one if
   needed) and puts the `Voter` on the request.
2. `BallotService`, in one transaction, asks `PollService.findOpen(id)` for
   the poll (404 if it does not exist, 409 if it is closed), checks that the
   ballot has the right shape and only this poll's option ids, and hands it to
   the voting system's service, which replaces the ballot stored under the
   voter's ballot key for this poll: delete, then insert. The voter's name, on a poll that shows names, is part of the
   ballot: `PollService.nameVoter` records it under the voter's name key, or
   forgets it when the ballot is withdrawn or carries none.
3. `findOpen` holds a shared lock on the poll until that transaction ends.
   Ballots do not wait for each other, but closing or deleting the poll waits
   for the ballots in flight, and a ballot arriving meanwhile waits, then
   finds the poll closed or gone: none is counted after closing.
4. `PollStream.changed(...)` is told the poll moved. The caller gets the fresh
   `PollView` straight away; watchers get an update a moment later.

### Identity

Anonymous first: a friend who opens a share link can vote at once. The cookie
holds 256 random bits, and the database never holds them, so a copy of it is
not enough to act as a voter. The cookie is
`HttpOnly` (scripts cannot read it) and `SameSite=Lax` (other sites cannot send
it with a `POST`, `PUT`, `PATCH` or `DELETE`), and no CORS is enabled, which is
what protects against cross-site request forgery.

Accounts will plug in at the same place: the filter will resolve a signed-in
account first and the anonymous token second (see [ROADMAP.md](ROADMAP.md)).

### Anonymity

Who can tell what someone chose, and what stops them:

- **Someone with a copy of the database** (a backup, a leak, a curious
  admin) learns nothing about who chose what. A `Voter` stores three
  different things:
  - polls it created, under `base64url(SHA-256(token))`;
  - its ballot on a poll, under `HMAC(secret, "ballot:" + poll + ":" + token)`;
  - its name on a poll, under `HMAC(secret, "name:" + poll + ":" + token)`.

  Names don't join with ballots, a voter's ballots don't join across polls,
  and a creator doesn't join with their own ballot. Nothing records when a
  ballot or a name was given. The server recomputes the keys for whoever
  holds the cookie, so revising works. Going the other way, from a row back
  to a person, means guessing a 256-bit token, even with the secret.
- **Others on the poll** see the tallies move. Among a few people, a tally
  that moves just as Sam taps "submit", or as "Sam" joins the names, shows
  what Sam chose, mention by mention in the live ballot mode. So a creator
  chooses, once, when the results show (`Poll.ResultsShown`): live (the
  form warns what that means), once a number of ballots are in (at least
  three; this spares the first voters, but each later ballot still moves the
  tallies), or once the poll is closed, which is the default on polls
  showing names. Until then, everyone, the creator included, sees only how
  many have voted. Closing is for good: reopening would let a creator read
  the results kept back and then watch the next ballots move them. Names
  are listed alphabetically, never in the order they came.
- **Someone looking at the voter's screen**, over a shoulder or on a
  projector, sees the ballot on it. A ballot counted before the page opened
  starts hidden behind "Change my ballot", on every screen size. The cookie
  still gives the ballot back to whoever holds the browser: that is what
  lets a voter revise it.
- **Whoever runs the server** sees every request, cookie and address as it
  happens. The design keeps nothing linkable at rest, but it does not hide
  ballots from the running server: that would take cryptographic voting
  (blind signatures, mix networks), well beyond deciding where to eat. The
  operator is trusted, and the privacy notice says so.

The secret is `ZVOTE_VOTER_SECRET` (at least 32 characters). The server
refuses to start without one; `spring-boot:run` sets a development secret in
`pom.xml`, and the tests set their own. Changing it orphans every ballot:
still counted, but nobody can revise theirs.

#### Known limit: insertion order

Ballot rows and name rows share no key and no time, but both are written as
voters come, in the same transaction. Ids count up; the database stores rows
roughly in the order written; PostgreSQL also stamps each row with the
transaction that wrote it (`xmin`) and logs every change, in order, in its
write-ahead log. So a copy of the database could pair the n-th name given
on a poll with the n-th ballot cast on it. Revisions, withdrawals and
anonymous voters blur the pairing, and it takes a copy of the database, a
poll that shows names and few voters.

Neither random nor encrypted ids close it: both hide the id's value, not
the order in which the rows were written, which the database keeps
anyway. What would close it for the tables is giving names no order to
read: one row per poll holding its names as a list, shuffled and rewritten
with every ballot. The write-ahead log would still hold the successive
versions until it is recycled, so archived logs must not outlive their
use. Not worth it yet; revisit if names come to matter more (public polls,
accounts).

### Names and join codes

A creator can make a poll show names. Voters then may give one with their
ballot; it is stored per poll (`voter_name`), never across polls, and it is
shown to everyone on the poll as a cloud under the results. Its key matches
no ballot row, and the cloud is alphabetical (see [Anonymity](#anonymity)).
Withdrawing the ballot takes the name away.

A join code is drawn at random from 31 characters without look-alikes
(887 million codes), unique among polls. It is shorter than the 128-bit share
token, so it is guessable in principle: lookups (`GET /api/join/{code}`) get a
rate limit at deployment.

### Retention

`PollRetention` deletes polls `zvote.limits.poll-lifetime-days` (30) after
their creation, every hour, and tells their watchers. Polls are for deciding,
not archiving, and keeping them briefly keeps little personal data around.
Tests switch the job off (`zvote.retention-cron: "-"`) and call it themselves.

### Tallies

Counts are never stored. One `GROUP BY` per poll derives them from the ballot
rows, so there is no second source of truth to keep in sync. A view's queries
share one snapshot (a read-only, repeatable-read transaction), so its tallies
and its ballot count always agree. The server sends
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
  once. It is computed after the watcher has joined, under the poll's lock, so
  a ballot landing meanwhile reaches the watcher too;
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
released and was rewritten in place; `V2` was added instead, so that
development databases migrate. From the first deployment on, only add
migrations.

### Errors

`ApiExceptionHandler` turns domain exceptions into RFC 9457 problem documents
whose `detail` can be shown to people as is: `InvalidRequestException` → 400,
`NotPollCreatorException` → 403, `PollNotFoundException` → 404,
`PollClosedException`, simultaneous ballots and lock time-outs → 409 ("try
again"). Spring MVC's own errors use the same format, and anything unexpected
is logged in full and answered 500 with a plain sentence and no details.

### Tests

- `ArchitectureTest`: the boundaries above.
- `PollApiTest`: the HTTP contract through MockMvc, on an in-memory H2
  migrated by Flyway: creation and validation, finding polls, both voting
  systems, revising and withdrawing, simultaneous ballots, closing, deleting,
  identity, error documents.
- `ServerFeaturesTest`: a server configured to offer less says so and refuses
  the rest.
- `PollStreamTest`: the stream's rules without a server: who receives what, in
  which order (the joining race, coalescing, dropped watchers, deletion,
  heartbeat, shutdown).
- `PollEventsTest`: the live stream over a real socket: first event,
  coalescing, closing, deletion, unknown poll.

`./mvnw test -Pcoverage` adds a JaCoCo report. Tests log warnings only, so a
green run prints nothing.

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
| `/` | join with a code, your polls, and public polls if the server offers them |
| `/new` | create a poll |
| `/p/:id` | a poll: your ballot, the live results, and the creator's controls |

A poll's page address is its share link.

### Data flow on a poll page

`usePoll(id)` loads the poll, then opens its event stream. Loading first
guarantees that the stream's first event is at least as recent as what was
loaded, so an update can neither be missed nor rolled back. Updates are merged
into the loaded poll; they are the same for every watcher, so `isMine` and
`myBallot` survive. After a ballot, the server's answer replaces the poll.

Browsers reconnect a dropped stream by themselves, but only after a network
error: when the server answers with an error (a proxy does while the server
restarts), `EventSource` gives up for good. `usePoll` then loads the poll and
watches it again every few seconds, until that works or the poll turns out to
have been deleted.

`useBallot` holds the ballot being filled in:

- **Live** (the default): each change is cast at once. Changes made while one
  is on its way are not all sent: the latest one is cast next, so the server
  always ends with the voter's last choice. Until the server answers, the page
  shows what the voter chose; if casting fails it falls back to what the server
  holds, and a toast explains why.
- **Envelope**: changes stay on the page until the voter submits them, and
  stay there if submitting fails.

Withdrawing, in either mode, goes through the live queue: it cannot overtake a
ballot that is still on its way. Renaming yourself on a counted ballot casts it
again (`recast`): through the live queue in live mode, and without the unsent
changes in envelope mode.

### The results visualisation

`MajorityJudgmentResultsGraph.tsx` draws one card per option, ranked by
`utils/majorityJudgment.ts`. Its centrepiece is the option's merit profile: one
bar whose slices are the seven mentions, best on the left, each exactly as wide
as its share of the ballots. A graduated axis sits right under the bar, never
on it; its bold 50% mark points at the majority mention, the one above it.
Pointing at a slice (or tapping it) dims the worse mentions
and says how many voters gave that mention or better; nothing moves. The card
adapts to its own width through container queries, not to the screen's.
`MajorityJudgmentResults.tsx` converts the API's options to its input.

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
`EventSource`), the ballot state machine, the form rules, the ballots and
results, the preferences, the toasts, and every screen with the API mocked,
including a lost stream and its recovery. `npm run coverage` measures them. The
end-to-end behaviour (two voters, live updates, a server restart, phone and
desktop layouts) was checked in a real browser; automating that in CI with
Playwright is on the roadmap.

## Decisions

| Decision | Why |
|---|---|
| One backend (Java) | SpacetimeDB is under the Business Source License, which forbids the open-source goal; the dual-backend layer went with it. |
| Java 25 | The current LTS. Since Java 24, a virtual thread blocked in `synchronized` code, as H2 and JDBC are, no longer holds on to its carrier thread. |
| Spring MVC on virtual threads, not WebFlux | Blocking code that reads top to bottom, with the concurrency of async. `ArchitectureTest` keeps Reactor out. |
| Spring Modulith for the boundaries | Each package declares the modules it may use, beside its code, and one test verifies them all. Only the annotations ship. |
| Spring Data JDBC, not JPA | No lazy loading or dirty checking, and it maps Java records, which JPA cannot. |
| REST + server-sent events, not GraphQL or WebSockets | Plain HTTP and one-way pushes cover every need, with nothing to negotiate. |
| H2 in file mode | No database to install or configure; the data file moves between machines. PostgreSQL arrives with deployment. |
| Tallies derived, never stored | One source of truth. |
| Ranking in the client | Majority judgment math lives in one tested module, next to the visualisation. |
| `PUT` for ballots | One ballot per voter per poll; cast, revise and withdraw are one operation, and retries are safe. |
| Share token as the only id | One identifier, unguessable, that doubles as the unlisted-poll secret. |
| Hashed voter ids | The database alone cannot be used to act as someone. |
| Ballots and names under keyed, per-poll HMACs | A copy of the database cannot tell who chose what, nor link a voter across polls. |
| Results live, after some ballots or at close, chosen per poll | Tallies moving as people vote show who chose what in a small group. |
| Closing is final | Final results stay final, and results kept back cannot be peeked at then watched. |
| A counted ballot starts hidden | The voter's screen is not a receipt for whoever looks at it. |
| Private by link or code; public polls off | Anyone could list anything anonymously; public polls come back for signed-in creators. "Only people I choose" needs accounts too. |
| Names per poll, optional | A cloud of who took part, without an account and without a profile kept across polls. |
| Polls deleted after 30 days | Data minimisation (GDPR), and nothing to archive for a group decision. |
| No client state library | Two data hooks and one ballot hook are all the state there is. |

## Known limits

- **Anonymous identity is per browser.** Clearing cookies, or another browser,
  is another voter. Fine among friends; not for decisions that must resist
  ballot stuffing, which need accounts.
- **Live updates are single-node** (see above).
- **Lists are capped** (50 public polls, 100 of your own) and not paginated.
