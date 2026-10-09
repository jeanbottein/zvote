# zvote HTTP API

The contract between the server (`servers/java`) and its clients. JSON over
HTTP, plus one server-sent event stream per poll. The TypeScript mirror of
these shapes is `clients/web/src/api/types.ts`.

In development the web client reaches the API through the Vite dev server
(`http://localhost:5173/api/...`, proxied to `:8080`), so every call is
same-origin.

## Identity

There are no accounts yet. The first `/api` request from a browser gets a
voter token in a cookie:

```
Set-Cookie: zvote_voter=<43 url-safe characters>; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax
```

Send it back on every request (`fetch(..., { credentials: 'include' })`,
`new EventSource(url, { withCredentials: true })`). Without it each request
counts as a brand new voter: your polls stop being yours and your ballots
cannot be revised. A cookie the server could not have issued is replaced.

The server never stores the token, and never sends voter ids back: `isMine`,
`admission` and `myBallot` are computed for the caller. It stores the polls
you create under a hash of the token, and your ballot, your name and the
invitation you used on each poll under other keys, keyed with a server
secret, that nothing else matches
(see [ARCHITECTURE.md](ARCHITECTURE.md#anonymity)).

A client that is not a browser - an agent, a script, a packaged app - asks
for a token of its own and sends it as a bearer token instead:

```
POST /api/voters          ->  201 {"token": "<43 url-safe characters>"}
Authorization: Bearer <token>
```

`POST /api/voters` mints, and never reveals: it always answers a voter nobody
has been before, never the caller's own token, so a script on a page that
called it would learn nothing. It grants nothing new either, since any `/api`
request already hands a fresh identity to whoever has none.

A bearer token comes before the cookie, and no cookie is set when one is sent.
A bearer token this server could not have issued answers `401` with
`WWW-Authenticate: Bearer`, rather than quietly becoming a new voter the way a
stale *cookie* does: a browser starting again is right, a client that chose to
send a credential casting ballots as a stranger is not.

## Endpoints

| Method | Path | Answer |
|---|---|---|
| `GET` | `/api/server-info` | `ServerInfo`: what this server offers |
| `POST` | `/api/voters` | `201` + `{"token"}`: a voter token, for a client that keeps its own |
| `GET` | `/api/polls` | `PollSummary[]`: the 50 most recent public polls (none while `publicPolls` is off) |
| `GET` | `/api/polls/mine` | `PollSummary[]`: the caller's polls, newest first |
| `POST` | `/api/polls` | `201` + `PollView`, `Location: /api/polls/{id}` |
| `GET` | `/api/polls/{id}` | `PollView` |
| `GET` | `/api/polls/{id}/results` | `PollUpdate`: the results, the same for everyone, `Cache-Control: max-age=1` |
| `POST` | `/api/polls/{id}/creator` | `PollView`: becomes the poll's creator, with `Zvote-Handover` |
| `GET` | `/api/join/{code}` | `PollSummary`: the poll behind a join code (only its letters and digits count, in any case) |
| `PATCH` | `/api/polls/{id}` | `PollView`: creator only, `{"closed": true}` closes it for good; anything else answers `400` |
| `DELETE` | `/api/polls/{id}` | `204`: creator only |
| `PUT` | `/api/polls/{id}/ballot` | `PollView`: cast, revise or withdraw the caller's ballot |
| `GET` | `/api/polls/{id}/events` | `text/event-stream`: live updates |
| `GET` | `/api/polls/{id}/invitations` | `InvitationPage`: creator only, the newest first (`?before=&limit=`) |
| `POST` | `/api/polls/{id}/invitations` | `201` + `InvitationPage`: creator only, `{"labels": ["Zoé", "Ali"]}` or `{"count": 500}` |
| `DELETE` | `/api/polls/{id}/invitations/{number}` | `204`: creator only, an invitation nobody voted with |
| `POST` | `/api/mcp` | the same services as Model Context Protocol tools |
| `GET` | `/v3/api-docs` | this API as OpenAPI (`.yaml` too) |
| `GET` | `/actuator/health` | `{"status":"UP"}`: readiness probe |

A poll's `id` is its **share token**: 22 url-safe characters, unguessable. It
is the only identifier that leaves the server, and it appears in the web
address of the poll (`/p/{id}`). Holding it is what gives access to an
unlisted poll. Its **join code** (`joinCode`, six characters such as `K7M4QX`,
shown as `K7M-4QX`) is a stand-in to type: `GET /api/join/{code}` answers the
poll's summary, or `404` "No poll has this code.".

Polls are deleted, with their ballots, `pollLifetimeDays` after they were
created (`expiresAt`).

## Shapes

### PollView

A poll as the calling voter sees it.

```jsonc
{
  "id": "R0JsGfPEiNuO7CoMMd_I5g",
  "joinCode": "K7M4QX",
  "title": "Where do we eat?",
  "votingSystem": "MAJORITY_JUDGMENT",   // or "APPROVAL"
  "visibility": "UNLISTED",              // or "PUBLIC"
  "invitationOnly": false,               // chosen at creation: only invited people vote (see Invitations)
  "showVoterNames": true,                // chosen at creation
  "resultsShown": "AFTER_BALLOTS",       // chosen at creation: LIVE, AFTER_BALLOTS or AFTER_CLOSING
  "resultsAfterBallots": 3,              // AFTER_BALLOTS only: ballots before the tallies show
  "createdAt": "2026-09-24T13:58:35.129057Z",
  "closedAt": null,                      // set once voting is closed, for good
  "expiresAt": "2026-10-24T13:58:35.129057Z", // when the server deletes it
  "isMine": true,                        // the caller created it
  "admission": "ADMITTED",               // whether the caller may vote: ADMITTED, NOT_INVITED or INVITATION_USED
  "totalBallots": 2,                     // voters with a ballot on this poll
  "options": [
    {
      "id": "1",
      "label": "Ramen",
      "approvalCount": null,             // approval polls: how many approved it
      "judgmentCounts": {                // majority judgment: voters per mention, worst first
        "Bad": 0, "Inadequate": 0, "Passable": 0, "Fair": 0,
        "Good": 1, "VeryGood": 0, "Excellent": 1
      },
      "rank": 1,                         // 1 is the winner; a rank shared means ex aequo
      "majorityMention": "VeryGood",     // majority judgment: the mention that ranks it
      "score": { "numerator": 0, "denominator": 1 }  // what separates options sharing one
                                         // (all five null while resultsShown keeps them back)
    }
  ],
  "voterNames": ["Sam", "Zoé"],          // null unless showVoterNames: the first 100 names given, alphabetical
  "moreVoterNames": false,               // more voters gave a name than voterNames holds
  "myBallot": {                          // null until the caller votes
    "approvedOptionIds": null,           // approval polls, in the poll's order
    "judgments": { "1": "Excellent" },   // majority judgment: option id -> mention
    "voterName": "Zoé"                   // the name the caller gave, or null
  },
  "handover": null                       // see "Creating a poll for somebody else"
}
```

While the poll is open, its options carry tallies only if `resultsShown` is
`LIVE`, or `AFTER_BALLOTS` with at least `resultsAfterBallots` ballots in
(fewer again after withdrawals, and they hide again). Otherwise they carry
none, for anyone, its creator included - no counts, and no ranking either, since
the order would say who is winning just as plainly; `totalBallots` still counts.
Watching tallies move as people vote shows what each of them chose. Closing
the poll shows them.
A closed poll cannot be reopened: its results are final, and a creator
cannot read the results kept for the closing and then watch the next
ballots move them.

Options come in the poll's own order, never sorted: that order is what a
ballot's bytes are positions in. Read `rank` to order them, and `rank == 1` for
the winner - several options at rank 1 are ex aequo.

The server ranks, and sends the counts it ranked from, so the ranking can be
checked rather than believed. It is computed in one place
(`servers/java/.../api/Ranking.java`, pinned by `RankingTest`): the majority
mention first - the best mention more than half the voters give an option or
better, which with an even number of ballots is the lower of the two middle
mentions - then the GMJ Usual score for options sharing one, as the exact
fraction `(above - below) / at`. Divide `score` to show it, never to compare
it: past about seventy million ballots two different scores round to the same
number, and two equal ones round apart.

### The seven mentions

Worst to best, spelled exactly like this on the wire, in the client and in the
stylesheets:

```
Bad, Inadequate, Passable, Fair, Good, VeryGood, Excellent
```

### PollSummary

`id`, `title`, `votingSystem`, `visibility`, `createdAt`, `closedAt` and
`isMine`: enough to list a poll and open it.

### PollUpdate

What watchers receive live: `{ "closedAt", "totalBallots", "options",
"voterNames", "moreVoterNames" }`. It is the same for every watcher, so a
client can merge it straight into its `PollView` and keep its own `isMine` and
`myBallot`. The names say who took part, by their own choice, never what they
chose; voters who gave none count in `totalBallots` only. They come in
alphabetical order (in the order given, they would line up with the ballots as
they landed), the first 100 of them: past that, a cloud is a list to scroll,
and a poll can have millions.

Tallies and `totalBallots` are as of the last fold of the ballots into the
tallies, a moment after they are cast (ARCHITECTURE.md,
[Tallies](ARCHITECTURE.md#tallies)): updates follow the folds.

`GET /api/polls/{id}/results` answers the same shape to a client that would
rather ask than hold a stream open. Being identical for everyone it carries
`Cache-Control: max-age=1`, so a crowd of readers can cost one read.

### ServerInfo

```json
{
  "features": { "publicPolls": false, "unlistedPolls": true, "approvalVoting": true, "majorityJudgment": true },
  "limits": { "maxOptions": 20, "maxTitleLength": 200, "maxOptionLength": 100,
              "maxVoterNameLength": 40, "maxInvitations": 1000, "pollLifetimeDays": 30 },
  "publicUrl": "https://zvote.example"
}
```

`publicUrl` is where this server's polls are reached, without a trailing
slash: what a client that cannot know its own address builds a share link
from, and what the server builds invitation links from. Null when it was not
told (`zvote.public-url`).

From `zvote.features` and `zvote.limits` in `application.yml`. The server
enforces them when a poll is created.

## Creating a poll

```json
POST /api/polls
{ "title": "Where do we eat?", "options": ["Ramen", "Tacos"],
  "votingSystem": "MAJORITY_JUDGMENT", "visibility": "UNLISTED", "invitationOnly": false,
  "showVoterNames": true, "resultsShown": "AFTER_BALLOTS", "resultsAfterBallots": 5 }
```

Every field is required but `invitationOnly` and `showVoterNames` (false
when left out), `resultsShown` (left out: `LIVE`, or `AFTER_CLOSING` if the
poll shows names or takes invitations, since a name appearing, or an
invitation used, as a ballot arrives shows who chose what) and
`resultsAfterBallots` (`AFTER_BALLOTS` only, and then at least 3: with
fewer, the results are the ballots). Public
polls are refused while `publicPolls` is off: they will need a signed-in
creator. Title and options are trimmed. There must be 2 to
`maxOptions` options, none empty, none longer than `maxOptionLength`, and no two
the same (ignoring case).

Send an `Idempotency-Key` header (1 to 64 printable characters without spaces,
such as a UUID) when the request may have to be sent again: a second attempt
with the same key answers the poll the first one made, rather than making
another. Keys belong to the voter that sent them, and are forgotten after a
day. `POST /api/polls/{id}/invitations` takes one too - without it, a retry
hands a second link to each of the same people, and each of them could then
vote twice. Casting a ballot is a `PUT` and needs no key.

## Creating a poll for somebody else

A client creating a poll on someone's behalf - an agent asked to run a vote -
sends `"handover": true`. The answer then carries a one-time token:

```jsonc
POST /api/polls
{ "title": "Where do we eat?", "options": ["Ramen", "Tacos"], "votingSystem": "APPROVAL",
  "visibility": "UNLISTED", "handover": true }

201 { "id": "R0JsGfPEiNuO7CoMMd_I5g", ..., "handover": "qWsD_0PPBuKgjv6h9yEQxA" }
```

Send its person the poll's address with the token in the fragment, which
browsers never send on:

```
https://zvote.example/p/R0JsGfPEiNuO7CoMMd_I5g#handover=qWsD_0PPBuKgjv6h9yEQxA
```

Opening it makes them the poll's creator - theirs to close, to delete, and
whose invitations are theirs to read - and the client that created it keeps
none of that. A client doing this itself sends the token in a header:

```
POST /api/polls/{id}/creator
Zvote-Handover: qWsD_0PPBuKgjv6h9yEQxA
```

The token works once: a handover link that leaked afterwards - into a chat, a
log, a mailbox - opens nothing (`403`, `/problems/handover-unavailable`). It is
signed rather than stored, so the database holds no credential, and a client
retrying the request that created the poll is told it again. `handover` is null
in every other answer: only the request that created the poll ever carries it.

## Casting a ballot

`PUT` replaces the caller's whole ballot. Casting, revising and withdrawing are
the same operation, so retrying is always safe. The answer is the poll as the
caller now sees it: their ballot (`myBallot`) always, and tallies that count it
too, unless so many ballots are arriving that it takes more than a quarter of
a second; then the next update does.

```jsonc
{ "judgments": { "1": "Excellent", "2": "Good" } }   // majority judgment
{ "approvedOptionIds": ["1", "3"] }                    // approval
{ "judgments": {} }  or  { "approvedOptionIds": [] }   // withdraw
{ "approvedOptionIds": ["1"], "voterName": "Zoé" }     // with a name
```

- The name is part of the ballot, on polls that show names: left out, null or
  blank, the voter takes part anonymously (and a name given before is
  forgotten). Spaces, tabs and line breaks become single spaces; at most
  `maxVoterNameLength` characters; invisible characters (controls, bidi
  overrides, zero widths) are refused. A poll that does not show names
  refuses one (`400`). Withdrawing forgets it.

- On a poll that takes invitations, only its creator and invited voters can
  cast a ballot (see [Invitations](#invitations)); anyone else gets `403`.
- Majority judgment: options left out are graded `Bad`, so every ballot grades
  every option.
- The shape must match the poll's voting system, every id must be an option of
  this poll, and every mention one of the seven, or the answer is `400`.
- A closed poll answers `409`. A ballot sent while the poll is being closed
  or deleted waits for that change, then answers `409` or `404`: a ballot is
  never counted after closing.
- Two ballots sent by the same voter at the same instant are applied one after
  the other, or one of them gets `409`. Send it again.

## Invitations

A poll created with `"invitationOnly": true` counts each person once, as long
as its creator hands out the links honestly. The creator makes invitations,
numbered 1, 2, 3... in the order they are made, and sends each its link: the
poll's address with the invitation's token in the fragment. The token is the
invitation's number and the server's signature of it for this poll.

```jsonc
POST /api/polls/{id}/invitations
{ "labels": ["Zoé", "Ali", "Bo"] }   // one invitation each: the names are shown to the creator only
{ "count": 500 }                     // 500 anonymous invitations at once; neither field, 1

201 { "count": 3, "next": null, "invitations": [
      { "number": 3, "token": "3.qWsD_0PPBuKgjv6h9yEQxA",
        "link": "https://zvote.example/p/{id}#invitation=3.qWsD_0PPBuKgjv6h9yEQxA",
        "label": "Bo", "used": false }, ... ] }
```

A creator with a list of people asks once and sends each of them their `link`:
one update and one batch, not one request per person. `link` is null when the
server was not told its public address (`publicUrl` in `ServerInfo`); the
address is the poll's with the invitation's token in the fragment.

A client sends the token in a header, to read the poll and to cast a ballot,
never in a URL: browsers do not send a fragment, so no server or proxy log
keeps it.

```
Zvote-Invitation: 3.qWsD_0PPBuKgjv6h9yEQxA
```

- The first ballot cast with an invitation makes it the caller's browser's
  (their cookie). From then on, that browser votes on the poll without the
  header, and no other browser can use the invitation: `409` "This
  invitation was already used, in another browser or on another device."
  A browser uses one invitation per poll; any other it brings stays unused.
- `admission` in the `PollView` says where the caller stands:
  - `ADMITTED`: they may vote. The poll is open to anyone, or they created
    it (a creator votes without an invitation), or they bring or used an
    invitation.
  - `NOT_INVITED`: they bring no valid invitation (none, one the server did
    not sign for this poll, or one taken back). Casting answers `403`.
  - `INVITATION_USED`: the invitation they bring was used in another
    browser.
- `GET /api/polls/{id}/invitations` answers the creator an `InvitationPage`:
  the newest invitations first, `limit` of them (100 unless asked, 1000 at
  most), below number `before` if given. `count` is how many they made and
  did not take back, and `next` is the `before` to ask for to read on (null
  once invitation 1 is in). `used` says who has voted, never with which
  ballot. `POST` answers the newest page too.
- `DELETE /api/polls/{id}/invitations/{number}` takes back an invitation
  nobody voted with, and its link stops working. Taking back one that was
  used answers `409`: its ballot stays counted.
- Links are signed, not stored: making 1 invitation or a billion costs the
  same, and so does reading a page. A poll takes up to `maxInvitations`
  (`400` past that), none once closed (`409`), and none if anyone may vote
  on it (`400`). Each label follows the rules of names (above); up to 100 go
  in one request, so the invitations just made are the top of the page it
  answers. `labels` and `count` are mutually exclusive: an invitation is for
  a person or for nobody in particular.
- Anyone holding the poll's own link or code can still open it, and see its
  results when they show: only voting needs an invitation.

## Live updates

```
GET /api/polls/{id}/events
Accept: text/event-stream
```

```
event:update
data:{"closedAt":null,"totalBallots":3,"options":[...]}

:heartbeat

event:deleted
data:{}
```

- The first event is always the current state, so a client that reconnects
  (browsers do it by themselves) is up to date at once.
- Browsers reconnect by themselves after a network error, but not after an
  error answer: a `404`, or a proxy's `502` while the server restarts. Load the
  poll again, then watch it again: that is what the web client does.
- A burst of ballots becomes one `update`, about 200 ms after it starts.
- Closing the poll sends an `update` (see `closedAt`).
- `deleted` ends the stream.
- A comment line every 20 s keeps proxies from closing an idle stream. Streams
  end after 30 minutes and browsers reconnect.

## Errors

Every error is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problem
document, `Content-Type: application/problem+json`. Its `detail` is written for
the person using the app and can be shown as is; its `type` says the same thing
to a machine, and is what to branch on.

```json
{ "type": "/problems/poll-closed", "title": "Conflict", "status": 409,
  "detail": "This poll is closed and no longer accepts ballots.",
  "instance": "/api/polls/R0JsGfPEiNuO7CoMMd_I5g/ballot" }
```

| `type` | Status | When |
|---|---|---|
| `/problems/invalid-request` | `400` | The request breaks a rule (the `detail` says which), or its JSON cannot be read |
| `/problems/unknown-voter` | `401` | A bearer token this server could not have issued (`WWW-Authenticate: Bearer`) |
| `/problems/not-poll-creator` | `403` | Only the poll's creator can do that |
| `/problems/not-invited` | `403` | Only invited people can vote on this poll |
| `/problems/handover-unavailable` | `403` | That handover token is spent, or not this poll's |
| `/problems/poll-not-found` | `404` | No poll has that id or join code (or it was deleted) |
| `/problems/poll-closed` | `409` | The poll is closed |
| `/problems/invitation-used` | `409` | Someone has already voted with that invitation |
| `/problems/collision` | `409` | Another change landed at the same moment; sending it again is safe (`Retry-After: 1`) |
| `/problems/server-error` | `500` | Something unexpected failed on the server; the `detail` says so and nothing more |

The `type` is a relative URI, which RFC 9457 resolves against the request, so
it holds whatever address the server answers on. Spring's own refusals (`405`,
`415`, a route that does not exist) are problem documents too, but carry no
`type`: RFC 9457 reads a missing one as `about:blank`, "no more than the
status". `429` is reserved for the rate limits of the deployment phase
(ROADMAP.md), so adding them will need no change here.

## Trying it with curl

```bash
# A voter token of your own, instead of a cookie jar.
ME=$(curl -s -X POST localhost:8080/api/voters \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

# Create a poll. The key makes it safe to send again if this times out.
ID=$(curl -s -X POST localhost:8080/api/polls \
  -H "Authorization: Bearer $ME" -H 'Idempotency-Key: lunch-today' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Lunch?","options":["Ramen","Tacos"],"visibility":"UNLISTED","votingSystem":"MAJORITY_JUDGMENT"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# Watch it live in another terminal.
curl -N localhost:8080/api/polls/$ID/events

# Vote (option ids come back in the poll's "options").
curl -s -X PUT localhost:8080/api/polls/$ID/ballot -H "Authorization: Bearer $ME" \
  -H 'Content-Type: application/json' -d '{"judgments":{"1":"Excellent","2":"Good"}}'

# Who won: the options at rank 1.
curl -s localhost:8080/api/polls/$ID/results
```

## For agents

Everything above is reachable two ways, and both go through the same services,
so there is one set of rules and no second contract.

- **This API**, described at `GET /v3/api-docs` (OpenAPI 3.1, `.yaml` too).
  The document carries the shapes, generated from the code, and the rules no
  shape can state: that an unrated option counts as `Bad`, that an invitation
  binds to the first voter who uses it, that closing is final, that the winner
  is rank 1, and what each problem `type` means.
- **Model Context Protocol**, at `POST /api/mcp` (stateless streamable HTTP),
  with nine tools: `create_poll`, `read_poll`, `poll_results`, `cast_ballot`,
  `invite`, `list_invitations`, `close_poll`, `delete_poll`, `list_my_polls`.
  A tool call is one request in and one answer out, carrying the same
  `Authorization: Bearer` token, so an agent is a voter like any other.
  `poll_results` names the winner outright.

A group of agents deciding together: one of them creates an invitation-only
poll, invites the others by name in a single call, and sends each the `link`
it answers; each agent mints a token of its own and casts a ballot with its
link; any of them reads `/results` until the ballots are in. Nothing about who
chose what is stored, for agents any more than for people.
