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

The server stores only a hash of the token, and never sends voter ids back:
`isMine` and `myBallot` are computed for the caller.

## Endpoints

| Method | Path | Answer |
|---|---|---|
| `GET` | `/api/server-info` | `ServerInfo`: what this server offers |
| `GET` | `/api/polls` | `PollSummary[]`: the 50 most recent public polls |
| `GET` | `/api/polls/mine` | `PollSummary[]`: the caller's polls, newest first |
| `POST` | `/api/polls` | `201` + `PollView`, `Location: /api/polls/{id}` |
| `GET` | `/api/polls/{id}` | `PollView` |
| `PATCH` | `/api/polls/{id}` | `PollView`: creator only, `{"closed": true \| false}` |
| `DELETE` | `/api/polls/{id}` | `204`: creator only |
| `PUT` | `/api/polls/{id}/ballot` | `PollView`: cast, revise or withdraw the caller's ballot |
| `GET` | `/api/polls/{id}/events` | `text/event-stream`: live updates |
| `GET` | `/actuator/health` | `{"status":"UP"}`: readiness probe |

A poll's `id` is its **share token**: 22 url-safe characters, unguessable. It
is the only identifier that leaves the server, and it appears in the web
address of the poll (`/p/{id}`). Holding it is what gives access to an
unlisted poll.

## Shapes

### PollView

A poll as the calling voter sees it.

```jsonc
{
  "id": "R0JsGfPEiNuO7CoMMd_I5g",
  "title": "Where do we eat?",
  "votingSystem": "MAJORITY_JUDGMENT",   // or "APPROVAL"
  "visibility": "PUBLIC",                // or "UNLISTED"
  "createdAt": "2026-09-24T13:58:35.129057Z",
  "closedAt": null,                      // set while voting is closed
  "isMine": true,                        // the caller created it
  "totalBallots": 2,                     // voters with a ballot on this poll
  "options": [
    {
      "id": "1",
      "label": "Ramen",
      "approvalCount": null,             // approval polls: how many approved it
      "judgmentCounts": {                // majority judgment: voters per mention, worst first
        "Bad": 0, "Inadequate": 0, "Passable": 0, "Fair": 0,
        "Good": 1, "VeryGood": 0, "Excellent": 1
      }
    }
  ],
  "myBallot": {                          // null until the caller votes
    "approvedOptionIds": null,           // approval polls, in the poll's order
    "judgments": { "1": "Excellent" }    // majority judgment: option id -> mention
  }
}
```

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

`PollView` without `totalBallots`, `options` and `myBallot`: enough to list a
poll and open it.

### PollUpdate

What watchers receive live: `{ "closedAt", "totalBallots", "options" }`. It
carries nothing about any one voter, so a client can merge it straight into its
`PollView` and keep its own `isMine` and `myBallot`.

### ServerInfo

```json
{
  "features": { "publicPolls": true, "unlistedPolls": true, "approvalVoting": true, "majorityJudgment": true },
  "limits": { "maxOptions": 20, "maxTitleLength": 200, "maxOptionLength": 100 }
}
```

From `zvote.features` and `zvote.limits` in `application.yml`. The server
enforces them when a poll is created.

## Creating a poll

```json
POST /api/polls
{ "title": "Where do we eat?", "options": ["Ramen", "Tacos"],
  "votingSystem": "MAJORITY_JUDGMENT", "visibility": "PUBLIC" }
```

Every field is required. Title and options are trimmed. There must be 2 to
`maxOptions` options, none empty, none longer than `maxOptionLength`, and no two
the same (ignoring case).

## Casting a ballot

`PUT` replaces the caller's whole ballot. Casting, revising and withdrawing are
the same operation, so retrying is always safe.

```jsonc
{ "judgments": { "1": "Excellent", "2": "Good" } }   // majority judgment
{ "approvedOptionIds": ["1", "3"] }                    // approval
{ "judgments": {} }  or  { "approvedOptionIds": [] }   // withdraw
```

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
- Closing and reopening the poll send an `update` (see `closedAt`).
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
| `404` | No poll has that id (or it was deleted) |
| `409` | The poll is closed, or the change collided with another made at the same moment (send it again) |
| `500` | Something unexpected failed on the server; the `detail` says so and nothing more |

## Trying it with curl

```bash
# Create a poll; the cookie jar keeps your voter token.
ID=$(curl -s -c me.txt -X POST localhost:8080/api/polls \
  -H 'Content-Type: application/json' \
  -d '{"title":"Lunch?","options":["Ramen","Tacos"],"visibility":"PUBLIC","votingSystem":"MAJORITY_JUDGMENT"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')

# Watch it live in another terminal.
curl -N localhost:8080/api/polls/$ID/events

# Vote (option ids come back in the poll's "options").
curl -s -b me.txt -X PUT localhost:8080/api/polls/$ID/ballot \
  -H 'Content-Type: application/json' -d '{"judgments":{"1":"Excellent","2":"Good"}}'
```
