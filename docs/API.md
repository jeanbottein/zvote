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

The server never stores the token, and never sends voter ids back: `isMine`
and `myBallot` are computed for the caller. It stores the polls you create
under a hash of the token, and your ballot and name on each poll under two
other keys, keyed with a server secret, that nothing else matches
(see [ARCHITECTURE.md](ARCHITECTURE.md#anonymity)).

## Endpoints

| Method | Path | Answer |
|---|---|---|
| `GET` | `/api/server-info` | `ServerInfo`: what this server offers |
| `GET` | `/api/polls` | `PollSummary[]`: the 50 most recent public polls (none while `publicPolls` is off) |
| `GET` | `/api/polls/mine` | `PollSummary[]`: the caller's polls, newest first |
| `POST` | `/api/polls` | `201` + `PollView`, `Location: /api/polls/{id}` |
| `GET` | `/api/polls/{id}` | `PollView` |
| `GET` | `/api/join/{code}` | `PollSummary`: the poll behind a join code (only its letters and digits count, in any case) |
| `PATCH` | `/api/polls/{id}` | `PollView`: creator only, `{"closed": true}` closes it for good; anything else answers `400` |
| `DELETE` | `/api/polls/{id}` | `204`: creator only |
| `PUT` | `/api/polls/{id}/ballot` | `PollView`: cast, revise or withdraw the caller's ballot |
| `GET` | `/api/polls/{id}/events` | `text/event-stream`: live updates |
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
  "showVoterNames": true,                // chosen at creation
  "resultsShown": "AFTER_BALLOTS",       // chosen at creation: LIVE, AFTER_BALLOTS or AFTER_CLOSING
  "resultsAfterBallots": 3,              // AFTER_BALLOTS only: ballots before the tallies show
  "createdAt": "2026-09-24T13:58:35.129057Z",
  "closedAt": null,                      // set once voting is closed, for good
  "expiresAt": "2026-10-24T13:58:35.129057Z", // when the server deletes it
  "isMine": true,                        // the caller created it
  "totalBallots": 2,                     // voters with a ballot on this poll
  "options": [
    {
      "id": "1",
      "label": "Ramen",
      "approvalCount": null,             // approval polls: how many approved it
      "judgmentCounts": {                // majority judgment: voters per mention, worst first
                                         // (both null while resultsShown keeps them back)
        "Bad": 0, "Inadequate": 0, "Passable": 0, "Fair": 0,
        "Good": 1, "VeryGood": 0, "Excellent": 1
      }
    }
  ],
  "voterNames": ["Sam", "Zoé"],          // null unless showVoterNames: the first 100 names given, alphabetical
  "moreVoterNames": false,               // more voters gave a name than voterNames holds
  "myBallot": {                          // null until the caller votes
    "approvedOptionIds": null,           // approval polls, in the poll's order
    "judgments": { "1": "Excellent" },   // majority judgment: option id -> mention
    "voterName": "Zoé"                   // the name the caller gave, or null
  }
}
```

While the poll is open, its options carry tallies only if `resultsShown` is
`LIVE`, or `AFTER_BALLOTS` with at least `resultsAfterBallots` ballots in
(fewer again after withdrawals, and they hide again). Otherwise they carry
none, for anyone, its creator included; `totalBallots` still counts.
Watching tallies move as people vote shows what each of them chose. Closing
the poll shows them.
A closed poll cannot be reopened: its results are final, and a creator
cannot read the results kept for the closing and then watch the next
ballots move them.

The server sends tallies, not rankings. Clients rank majority judgment options
themselves from the seven counts (`clients/web/src/utils/majorityJudgment.ts`:
majority mention first, then the GMJ score).

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

### ServerInfo

```json
{
  "features": { "publicPolls": false, "unlistedPolls": true, "approvalVoting": true, "majorityJudgment": true },
  "limits": { "maxOptions": 20, "maxTitleLength": 200, "maxOptionLength": 100,
              "maxVoterNameLength": 40, "pollLifetimeDays": 30 }
}
```

From `zvote.features` and `zvote.limits` in `application.yml`. The server
enforces them when a poll is created.

## Creating a poll

```json
POST /api/polls
{ "title": "Where do we eat?", "options": ["Ramen", "Tacos"],
  "votingSystem": "MAJORITY_JUDGMENT", "visibility": "UNLISTED", "showVoterNames": true,
  "resultsShown": "AFTER_BALLOTS", "resultsAfterBallots": 5 }
```

Every field is required but `showVoterNames` (false when left out),
`resultsShown` (left out: `LIVE`, or `AFTER_CLOSING` if the poll shows
names, since a name and a ballot arriving together show who chose what) and
`resultsAfterBallots` (`AFTER_BALLOTS` only, and then at least 3: with
fewer, the results are the ballots). Public
polls are refused while `publicPolls` is off: they will need a signed-in
creator. Title and options are trimmed. There must be 2 to
`maxOptions` options, none empty, none longer than `maxOptionLength`, and no two
the same (ignoring case).

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

- Majority judgment: options left out are graded `Bad`, so every ballot grades
  every option.
- The shape must match the poll's voting system, every id must be an option of
  this poll, and every mention one of the seven, or the answer is `400`.
- A closed poll answers `409`. A ballot sent while the poll is being closed
  or deleted waits for that change, then answers `409` or `404`: a ballot is
  never counted after closing.
- Two ballots sent by the same voter at the same instant are applied one after
  the other, or one of them gets `409`. Send it again.

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
the person using the app and can be shown as is.

```json
{ "title": "Conflict", "status": 409,
  "detail": "This poll is closed and no longer accepts ballots.",
  "instance": "/api/polls/R0JsGfPEiNuO7CoMMd_I5g/ballot" }
```

(`type` is omitted: it is the default, `about:blank`.)

| Status | When |
|---|---|
| `400` | The request breaks a rule (the `detail` says which), or its JSON cannot be read |
| `403` | Only the poll's creator can do that |
| `404` | No poll has that id or join code (or it was deleted) |
| `409` | The poll is closed, or the change collided with another made at the same moment (send it again) |
| `500` | Something unexpected failed on the server; the `detail` says so and nothing more |

## Trying it with curl

```bash
# Create a poll; the cookie jar keeps your voter token.
ID=$(curl -s -c me.txt -X POST localhost:8080/api/polls \
  -H 'Content-Type: application/json' \
  -d '{"title":"Lunch?","options":["Ramen","Tacos"],"visibility":"UNLISTED","votingSystem":"MAJORITY_JUDGMENT"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# Watch it live in another terminal.
curl -N localhost:8080/api/polls/$ID/events

# Vote (option ids come back in the poll's "options").
curl -s -b me.txt -X PUT localhost:8080/api/polls/$ID/ballot \
  -H 'Content-Type: application/json' -d '{"judgments":{"1":"Excellent","2":"Good"}}'
```
