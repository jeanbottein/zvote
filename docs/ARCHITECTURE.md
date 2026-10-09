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
Flyway, H2 in file mode or PostgreSQL, Spring Modulith. About 1,500 lines of
code, in six modules, one per package under `org.zvote.server`:

| Module | Uses | Holds |
|---|---|---|
| `polls` | `common` | `Poll`, `PollOption`, `PollService`: every rule about polls; who may vote, in `InvitationService` and `InvitationLinks` |
| `ballots` | nothing | ballots, one byte per option; their tallies (`TallyService`); `Mention` |
| `api` | everything | controllers, the services that join polls and ballots, DTOs, error mapping |
| `identity` | `common` | the voter cookie and `VoterIdentityFilter` |
| `live` | nothing | `PollStream`: server-sent events |
| `common` | nothing | `ZVoteProperties`, `VoterSecret`, `InvalidRequestException` |

Each module says what it is, and which modules it may use, in its
`package-info.java` (`@ApplicationModule`). Its API is its root package; its
sub-packages (`api.dto`) are its own. `ArchitectureTest` has Spring Modulith
verify it all: polls and ballots ignore each other (only `api` knows both, and
what a ballot's bytes mean), nothing depends on `api`, `live` and `identity`
know nothing about the domain, and there are no cycles. ArchUnit adds what a
module declaration cannot say: repositories are package-private (so only the
service beside one can use it), data classes are records, and nothing imports
Reactor.

### Casting a ballot, step by step

1. `VoterIdentityFilter` reads the `zvote_voter` cookie (issuing one if
   needed) and puts the `Voter` on the request.
2. `BallotService`, in one transaction, asks `PollService.findOpen(id)` for
   the poll (404 if it does not exist, 409 if it is closed), and
   `InvitationService.admit` whether the voter may vote on it (403 if not;
   see [Invitations](#invitations)). It checks that the
   ballot has the right shape and only this poll's option ids, and encodes it
   as one byte per option, in the options' order (`BallotFormat`: a mention's
   rank, or 1 for an approved option). `BallotBoxService` replaces the voter's
   row (one per voter and poll, under their ballot key) and records what
   changed, from what to what, in `ballot_change`. The voter's name, on a poll
   that shows names, is part of the ballot: `PollService.nameVoter` records it
   under the voter's name key, or forgets it when the ballot is withdrawn or
   carries none.
3. `findOpen` holds a shared lock on the poll until that transaction ends.
   Ballots do not wait for each other, but closing or deleting the poll waits
   for the ballots in flight, and a ballot arriving meanwhile waits, then
   finds the poll closed or gone: none is counted after closing.
4. Once committed, the request asks `TallyFolding` to fold the change into
   the tallies and waits for it, a quarter of a second at most (see
   [Tallies](#tallies)). The caller then gets the fresh `PollView`, and
   watchers an update a moment later.

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
  admin) learns nothing about who chose what. A `Voter` stores four
  different things:
  - polls it created, under `base64url(SHA-256(token))`;
  - its ballot on a poll, under `HMAC(secret, "ballot:" + poll + ":" + token)`;
  - its name on a poll, under `HMAC(secret, "name:" + poll + ":" + token)`;
  - the invitation it used on a poll, marked with
    `HMAC(secret, "invitation:" + poll + ":" + token)`.

  Names and invitations don't join with ballots, a voter's ballots don't
  join across polls, and a creator doesn't join with their own ballot.
  Nothing records when a ballot, a name or an invitation was given. The
  server recomputes the keys for whoever holds the cookie, so revising
  works. Going the other way, from a row back to a person, means guessing a
  256-bit token, even with the secret. Invitation links are signed, not
  stored: the copy holds none to vote with either.
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
- **The creator of a poll that takes invitations** knows whom each link went
  to, and sees which links were used: who voted, never what they chose.
  They hold every link, but a link only works in the browser that first
  voted with it: opened anywhere else, it shows neither the ballot nor a way
  to change it. Showing which were used gives nothing away, since a used
  link opened elsewhere says so anyway. Seen next to live tallies, a link
  turning used does show what its voter chose, so such polls show their
  results at close unless the creator asks otherwise. What the design
  cannot stop is a creator voting with links they kept before sending them:
  the people concerned then find theirs used, and can say so. An invitation
  poll trusts its creator to hand out the links honestly, as any election
  trusts whoever draws up the list of voters.
- **Someone looking at the voter's screen**, over a shoulder or on a
  projector, sees the ballot on it. A ballot counted before the page opened
  starts hidden behind "Change my ballot", on every screen size. The cookie
  still gives the ballot back to whoever holds the browser: that is what
  lets a voter revise it.
- **Whoever runs the server** sees every request, cookie and address as it
  happens. The design keeps nothing linkable at rest, but it does not hide
  ballots from the running server: that would take cryptographic voting
  (blind signatures, mix networks), well beyond deciding where to eat. The
  operator is trusted, which the privacy page must say (roadmap, phase 6).

The secret is `ZVOTE_VOTER_SECRET` (at least 32 characters). The server
refuses to start without one; `spring-boot:run` sets a development secret in
`pom.xml`, and the tests set their own. Changing it orphans every ballot:
still counted, but on an open poll its voter is told they have not voted,
and voting again counts them twice (their name shows twice too). So never
change it while polls are open, and give every server that shares a
database, development runs included, the same one.

#### Known limit: what the database itself records

Ballot rows, name rows and invitations share no key and no time, but a
voter's ballot and name, and the invitation their first ballot used, are
written in one transaction, as voters come.

- **On PostgreSQL, exactly.** Every row carries the transaction that wrote
  it (`xmin`), so whoever can query the live database, or holds a physical
  copy of it (a base backup, a replica), can join a name, or an invitation
  and so whom it was for, to its ballot. A name row is only rewritten when
  the name changes, and an invitation never again, so a revised ballot no
  longer shares their transaction, but a first ballot does. That
  reaches the operator, who is trusted anyway (above); backups stay
  logical (`pg_dump`), which carry no `xmin`.
- **In any copy, roughly.** Rows are stored about in the order written (and
  names have ids that count up; ballots have none), so a dump can line up the
  n-th name of a poll with the n-th ballot. Revisions, withdrawals and
  anonymous voters blur that. The change log does keep ballots in order, but
  only for the moment until they are folded.

Neither random nor encrypted ids help: both hide an id's value, not when its
row was written. What would close it is writing names apart from ballots,
later and shuffled (a job that adds a poll's new names every minute, in
random order), with the trade-off that a name shows up a minute late. Not
worth it yet; revisit before names matter more (public polls, accounts).

### Names and join codes

A creator can make a poll show names. Voters then may give one with their
ballot; it is stored per poll (`voter_name`), never across polls, and it is
shown to everyone on the poll as a cloud under the results: the first 100
names in alphabetical order, then how many more voted. Its key matches no
ballot row (see [Anonymity](#anonymity)). Withdrawing the ballot takes the name
away.

A join code is drawn at random from 31 characters without look-alikes
(887 million codes), unique among polls. It is shorter than the 128-bit share
token, so it is guessable in principle: lookups (`GET /api/join/{code}`) get a
rate limit at deployment.

### Invitations

A creator can make a poll take invitations (`Poll.invitationOnly`, chosen at
creation): only the people they invite may vote, each with a link of their
own. They make invitations one at a time, with a label for whom each is for
if they like, which only they see, or many at once through the API, and send
each link themselves (the share dialog offers copy, QR code, email and the
device's share sheet).

- **Signed, not stored.** Invitations are numbered 1, 2, 3... per poll, and a
  link's token is the number and the server's 128-bit signature of it for
  this poll (`InvitationLinks`: `HMAC(secret, "link:" + poll + ":" +
  number)`, cut to 16 bytes). The server tells a link it made by signing
  again. Making invitations moves a counter (`invitation_count`), and an
  invitation gets a row only once something is known of it: a label, a
  ballot cast with it, or that it was taken back. So a billion invitations
  cost what one does, and a copy of the database holds no link anyone could
  vote with.
- **Never in a URL the server sees.** The link carries the token in its
  fragment (`/p/{id}#invitation=...`), which browsers never send, and the
  client passes it in the `Zvote-Invitation` header.
- **Held by the first browser that votes.** The first ballot cast with an
  invitation marks it used by that browser (`InvitationService.admit`, in the
  casting transaction: of two browsers voting with one link at the same
  moment, one is refused). From then on that browser votes without the link,
  and no other can use it. The creator votes without one.
- **Said before anyone tries.** Every `PollView` says whether its reader may
  vote (`admission`), so the page explains why not: no invitation, a link
  that is not valid, or an invitation used elsewhere.
- **Read a page at a time.** The creator reads them newest first, up to 1,000
  at a time, with the links signed as the page is read. Only creators' actions
  write the counters: voters never wait on them.
- An invitation nobody voted with can be taken back; one that was used
  cannot, since its ballot cannot be found to remove it.

### Retention

`PollRetention` deletes polls `zvote.limits.poll-lifetime-days` (30) after
their creation, every minute, and tells their watchers. Polls are for deciding,
not archiving, and keeping them briefly keeps little personal data around.
Tests switch the job off (`zvote.retention-cron: "-"`) and call it themselves.

A deleted poll (by its creator or by retention) disappears at once, with its
options, tallies and invitation counter, but its ballots, names and
invitations can be billions: they have no foreign key to the poll, and the
same job removes them afterwards, 10,000 per transaction, from the list of
deleted polls (`poll_removal`) that the deletion wrote in its own
transaction. No transaction grows with the size of a poll, and nothing is
left behind.

### Tallies

Tallies are stored, so that reading them costs the same at any size: a few
counters per option (`tally`) and the number of ballots (`ballot_count`),
created with the poll (`PollCreationService`, in the poll's transaction).
Ballots never update them: each ballot only inserts what it changed into
`ballot_change`, and `TallyFolding`, a thread of its own, folds those changes
into the counters in batches of up to 10,000 (`TallyService.fold`), then tells
the polls' watchers. That keeps the hot path insert-only: no ballot ever waits
for another on a counter.

- **Exact.** A fold takes its changes, adds them up and deletes them in one
  transaction, so each is counted once. `FOR UPDATE SKIP LOCKED` lets several
  servers fold side by side, and counters are always updated in the same
  order, so two folds never deadlock.
- **A moment behind.** A ballot's request waits for its fold (250 ms at most,
  `zvote.fold-patience`): with few ballots, its answer counts it; with many,
  it shows in the next update. Closing waits for every fold, so final results
  are final.
- **Rebuildable.** Folding only adds and subtracts, so the counters can always
  be recomputed from the ballots (`PollApiTest.Tallies` does).

A view's queries share one snapshot (a read-only, repeatable-read
transaction), so its tallies and its ballot count always agree. The server sends
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

Updates come from the folds: each fold tells `PollStream` which polls moved.
Ballots are folded side by side on several servers already, but watchers only
hear of the folds of their own server: a second instance will need a shared
channel (PostgreSQL `LISTEN/NOTIFY` or Redis) to relay `changed` calls between
nodes.

### Persistence

Flyway owns the schema (`src/main/resources/db/migration`). The SQL is portable
(`GENERATED BY DEFAULT AS IDENTITY`, `TIMESTAMP WITH TIME ZONE`, `BYTEA`,
`LIMIT`, `FOR UPDATE SKIP LOCKED`), and the whole test suite passes on both
databases: H2 in development, PostgreSQL in production
(`SPRING_DATASOURCE_URL=jdbc:postgresql://...`; see the server's README). Table
names are singular and unquoted and entities have no `@Table`: see the note at
the top of `V1__init.sql`. Ballots, the change log, tallies and invitations
are written with `JdbcClient` rather than entities: their keys are two
columns, and folding updates counters in batches. Nothing has been deployed
yet, so `V1__init.sql` is the whole schema, rewritten in place when it
changes, and development databases are deleted (`rm -rf data`). From the
first deployment on, only add migrations.

On PostgreSQL, give the connection a lock timeout
(`?options=-c%20lock_timeout%3D2s`), as H2 has by default: a ballot that waits
longer than that for a poll being changed is then told to try again (409)
instead of waiting for as long as it takes. Spring leaves PostgreSQL's
timeout uncategorized; `ApiExceptionHandler` recognises it.

### Scale

Measured on a laptop (Apple M1, 8 GB, PostgreSQL 14), majority judgment, in
[PERFORMANCE.md](PERFORMANCE.md#ballots-at-scale):

- 2,400 to 3,700 ballots per second end to end over HTTP, 64 voters at a
  time, with a median answer of 17 to 23 ms, and the same rate at 200,000
  ballots as at 50,000. The previous design, which recounted the whole poll
  on every ballot, did 58 per second at 50,000 ballots, a median of 0.8 s.
- On a poll of 10 million ballots, loading the page takes 3 ms and a ballot,
  folded in, 3 to 10 ms.
- A ballot takes 183 bytes, about 180 GB per billion.

A billion ballots in a day is about 11,600 per second. The database alone
records over 11,000 per second on this laptop; a production server would
add CPU. Beyond one PostgreSQL server, ballots split by voter (Citus, or a
shard key) with folds on each shard. What else stands between zvote and a
billion-ballot poll is in [ROADMAP.md](ROADMAP.md#scale): live updates across
servers, results through a CDN for millions of watchers, and, above all,
identity: one cookie per browser cannot stop anyone from voting twice.
Invitations count each person once at any size (a billion of them cost a
counter), but someone has to hand each link to its person.

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
  migrated by Flyway: creation and validation, finding and joining polls,
  both voting systems, revising and withdrawing, simultaneous ballots, tallies
  that add up when 60 voters revise at once, results kept back, names,
  closing, deleting, retention, anonymity, identity, error documents.
- `ServerFeaturesTest`: a server configured to offer more or less says so and
  refuses the rest.
- `PollStreamTest`: the stream's rules without a server: who receives what, in
  which order (the joining race, coalescing, dropped watchers, deletion,
  heartbeat, shutdown).
- `PollEventsTest`: the live stream over a real socket: first event,
  coalescing, names, results shown at closing, deletion, unknown poll.
- Unit tests for what needs no server: the ballot format (`BallotFormatTest`),
  a voter's keys, the mentions, the configuration's limits, the error mapping.

The same suite runs on PostgreSQL (see the server's README) and as a native
image (`./mvnw -PnativeTest test`). `./mvnw test -Pcoverage` adds a JaCoCo
report. Tests log warnings only, so a green run prints nothing.

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
  ui/                  shared pieces: dialog, segmented control, toasts, icons, keys
  utils/               majorityJudgment.ts: the GMJ ranking math; formatCount.ts
  test/                the test setup, rendering helpers and shared fixtures
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
| `/about` | how results are decided, the research behind it, the source code |

A poll's page address is its share link. An invitation's link adds the
invitation in the fragment (`#invitation=...`), which the page passes to the
server in a header.

### Data flow on a poll page

`usePoll(id, invitation)` loads the poll, as seen with the invitation the
voter came with, then opens its event stream. Loading first
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
ballot that is still on its way. The voter's name goes with the ballot: in
live mode, renaming yourself casts the ballot again (`recast`), after any on
its way and always with the latest name; in envelope mode it is one more change
to submit.

A ballot counted before the page opened starts hidden behind "Change my
ballot", and a ballot the voter touches stays open. While a poll keeps its
results back, the server sends no tallies, and the results section says when
they will show.

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
| Tallies stored and folded from a change log, rebuildable from the ballots | Reading them costs the same at any size, and ballots never wait for each other on a counter. |
| One row per ballot, one byte per option | 183 bytes a ballot, and one row to replace when it changes. |
| Ranking in the client | Majority judgment math lives in one tested module, next to the visualisation. |
| `PUT` for ballots | One ballot per voter per poll; cast, revise and withdraw are one operation, and retries are safe. |
| Share token as the only id | One identifier, unguessable, that doubles as the unlisted-poll secret. |
| Hashed voter ids | The database alone cannot be used to act as someone. |
| Ballots and names under keyed, per-poll HMACs | A copy of the database cannot tell who chose what, nor link a voter across polls. |
| Results live, after some ballots or at close, chosen per poll | Tallies moving as people vote show who chose what in a small group. |
| Closing is final | Final results stay final, and results kept back cannot be peeked at then watched. |
| A counted ballot starts hidden | The voter's screen is not a receipt for whoever looks at it. |
| Private by link or code; public polls off | Anyone could list anything anonymously; public polls come back for signed-in creators. Choosing who may open a poll needs accounts too. |
| Invitations made by the creator, held by the first browser that votes | Each person counted once without accounts. The creator holds every link, but a used one shows them nothing. |
| Invitation links signed, not stored | A billion invitations cost a counter, and a copy of the database holds no link to vote with. |
| Invitation tokens in the fragment and a header | No server or proxy log ever holds one. |
| Names per poll, optional | A cloud of who took part, without an account and without a profile kept across polls. |
| Polls deleted after 30 days | Data minimisation (GDPR), and nothing to archive for a group decision. |
| No client state library | Two data hooks and one ballot hook are all the state there is. |

## Known limits

- **Anonymous identity is per browser.** Clearing cookies, or another browser,
  is another voter. Fine among friends, and the creation form says so: zvote
  counts on voters' good faith, and the ballot count shows when it is
  abused. Decisions that must resist ballot stuffing take invitations, which
  trust the creator instead, or will take accounts (roadmap, phase 7).
- **An invitation works in one browser.** A voter who changes device, or
  clears their cookies, can no longer change their ballot, and the creator
  cannot give them another link without counting them twice. Accounts will
  carry a ballot across devices.
- **Live updates are single-node** (see above), though folding is not.
- **Lists are capped** (50 public polls, 100 of your own) and not paginated.
