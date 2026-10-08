# zvote roadmap

Where the project stands and what comes next, in order. Each phase should leave
the codebase as simple as it found it: add what the phase needs, no more.

## Done

| Phase | What |
|---|---|
| 0 | Portable repo: Maven wrapper, pinned toolchain (`.tool-versions`), `./dev.sh` |
| 1 | H2 in file mode with Flyway migrations |
| 2 | One backend: SpacetimeDB and the dual-backend layer removed (licence: see ARCHITECTURE.md) |
| 3 | Server rebuilt: Spring Boot 4.1, MVC on virtual threads, JDBC, REST + SSE; anonymous identity; closing polls; RFC 9457 errors; tests for the whole HTTP contract and the live stream |
| 4 | Client rebuilt against it: one API module, three screens, mobile-first design, live and envelope ballots, tests |
| 5 | MVP for groups: private polls shared by link or join code (`K7M-4QX`), optional voter names shown as a cloud under the results, polls deleted 30 days after creation; public polls off until accounts |
| 5b | Ballots at scale, first step (see [Scale](#scale)): one row per ballot, tallies folded from a change log, deleted polls removed in batches, PostgreSQL supported and tested; 41 times faster on PostgreSQL, and as fast on a poll of 10 million ballots as on a new one |

## Next

### 6. Deployment (OVHcloud)

Before accounts, which need an HTTPS domain. A small OVHcloud VPS in France is
enough (the native image serves on about 100 MB): Docker Compose with Caddy
(automatic Let's Encrypt certificates) in front of the server and PostgreSQL,
and a nightly `pg_dump` to OVH Object Storage. GitHub Actions runs the tests,
builds the image, pushes it to GHCR and deploys it.

- **PostgreSQL**: supported already, and the test suite passes on it (see
  the server's README). Left for CI: a PostgreSQL profile (a service
  container, or Testcontainers). The connection URL sets a lock timeout
  (`?options=-c%20lock_timeout%3D2s`). Locally H2 stays, so nothing needs
  installing.
- **Startup and memory**: measured in [PERFORMANCE.md](PERFORMANCE.md). The
  native image works, H2 included, and with profile-guided optimization starts
  in 0.13 s on 100 MB and serves as much as the JVM; the JVM with a Leyden AOT
  cache and Spring AOT starts in 1.1 s at no cost. Choose on the target (Linux,
  PostgreSQL), and run `-PnativeTest` in CI if the native image is chosen.
- **One origin.** The server serves the built client, which keeps cookies
  first-party and enables the Open Graph pages above.
- **Hardening.** TLS (the cookie turns `Secure` on its own behind HTTPS), a
  Content Security Policy, and rate limits on poll creation, ballots and join
  code lookups (a join code is guessable in principle; the link is not).
- **The voter secret.** `ZVOTE_VOTER_SECRET` (`openssl rand -base64 48`)
  comes from the host's secrets: never from the image, the repository or
  the database backups. The server refuses to start without it. Losing or
  changing it orphans every ballot: still counted, but voters are told they
  have not voted, and voting again counts them twice; so it never changes
  while polls are open (see [ARCHITECTURE.md](ARCHITECTURE.md#anonymity)).
  Access logs keep no request bodies, and only for a short time. Backups
  stay logical (`pg_dump`): a physical copy keeps which transaction wrote
  each row, and with it which name goes with which ballot.
- **Legal pages** (France and the EU; a checklist, not legal advice). The voter
  cookie and voter names are personal data, so GDPR applies already: a privacy
  page (what is stored, why, for how long, your rights, a contact address;
  and plainly, that ballots are unlinkable at rest but the server operator
  is trusted),
  answering access and deletion requests, a one-page record of processing,
  and telling the CNIL of a breach within 72 hours. No cookie banner as long
  as the only cookie is the one the service needs (CNIL exemption for strictly
  necessary cookies): analytics would change that. Mentions légales (LCEN):
  the publisher and the host; a private person may publish the host's details
  only, having given their identity to the host. A contact to report illegal
  content (titles, options, names), acted on promptly. Hosting in France keeps
  the data in the EU.
- **Several nodes.** Relay live updates through PostgreSQL `LISTEN/NOTIFY` or
  Redis.
- **End-to-end tests in CI** with Playwright, on a phone viewport and a
  desktop one.

### 7. Accounts and social sign-in

Goal: sign in with Google, Apple and other OpenID Connect providers, keep
ballots cast before signing in, bring back public polls for signed-in
creators, and make polls restricted to chosen people possible. It needs the
deployment first: providers only redirect to an HTTPS address on a real
domain (Apple also needs a paid developer account).

- **Server.** Add `spring-boot-starter-security-oauth2-client` and let Spring
  Security run the OpenID Connect login (`/oauth2/authorization/{provider}`),
  with a server-side session in an HttpOnly cookie. Tokens never reach the
  page's JavaScript. Add an `account` table (provider, subject, created) and a
  `/api/me` endpoint. Ask providers for the `openid` scope only: the subject
  is all an account needs, and no email or real name is then stored.
- **One place for identity.** `VoterIdentityFilter` resolves the signed-in
  account first and the anonymous token second. Everything else keeps using
  the `Voter` it puts on the request. A signed-in `Voter` derives its keys
  from the account rather than the token. Since accounts are few, a copy of
  the database *with* the secret could then try each one: one more reason to
  keep the secret out of backups.
- **Keep the anonymous past.** At sign-in, move the anonymous voter's ballots
  and polls onto the account, in one transaction. Polls: update
  `creator_id`. Ballots and names are keyed per poll, so re-key them: for
  each poll still alive (30 days at most), look up the anonymous keys and
  rewrite them as the account's. Where both identities voted on the same
  poll, ballots record no time to tell which is newer: keep the one cast
  from this browser, the one its voter just saw. Without this, ballots cast
  before signing in are orphaned.
- **A voter code, not a receipt.** Accounts answer "revise my ballot from
  another device". Before them, a code that restores the voter token
  elsewhere would do. It must never show the choices on its own, or someone
  could demand to see it: secret ballots avoid such receipts on purpose.
- **Public polls.** Turn `public-polls` back on, for signed-in creators only.
- **Polls for accounts only.** The creator may require signing in to vote:
  one ballot per account, not per browser. That raises the bar but does not
  close it, since anyone can open several accounts. Say so where the option
  is offered, as the creation form already says it of browsers.
- **Invitation polls.** For votes that must count each person once, the
  creator generates one link per voter and sends each to one person.
  These polls don't need accounts and could come before them.
  - Each link carries its own voter token, so it holds exactly one ballot,
    which can be revised. The poll can't be joined by its share link or code.
  - Each invitation is anonymous, or bears a pseudonym that the creator or
    the voter gives.
  - The creator answers for sending each link to the right person, and could
    vote with a link they kept: the trust moves from the voters to the
    creator. The form must say so.
  - Keep invitations as unlinkable from ballots as browsers are today: a
    ballot is keyed by the invitation's token, as by the cookie's.
  - Whether to show the creator which invitations were used is the owner's
    call. Showing it tells the creator who voted, though never what.
  - Sending: one row per invitation with icons to share it (copy, QR code,
    email, SMS, the usual messengers through `navigator.share`), and a way
    to mark it sent. The native app makes this easier (phase 9).
- **Restricted polls.** A `PRIVATE` visibility: only listed accounts (or
  a group) can open the poll. The check belongs in `PollService.find`, where
  visibility rules live.
- **Rich links.** When a poll's link is pasted into a chat, show its title and
  a preview image (Open Graph tags). That needs the server to render
  `index.html` for `/p/{id}`, which it can once it serves the client (see
  phase 6).
- **Client.** A sign-in button that simply navigates to the provider (no
  client-side OAuth), the account in the settings sheet, sign-out.

### 8. Installable web app

Web app manifest and icons, a service worker that caches the shell so the app
opens offline and says so, and an install prompt. The layout is already built
for phones (safe areas, touch targets, bottom sheets).

### 9. Android app (Capacitor)

Capacitor wraps the built client in a native shell, so the Android app is the
same code and the same design. Already in place: the mobile-first UI, and
`VITE_API_BASE_URL` to point a packaged build at the real server.

Still to do:

- **Authentication across origins.** A packaged app runs on its own origin, so
  the cookie becomes third-party. Either issue a bearer token after an OIDC
  sign-in with PKCE through the system browser, or use `SameSite=None; Secure`
  cookies with CORS for the app's origin. The bearer token is the sturdier
  choice; `VoterIdentityFilter` is where it would be read.
- **Deep links.** Android App Links (`assetlinks.json`) so `/p/{id}` links open
  the app.
- **Share links** built from the public web address, not the app's origin
  (`ShareButton` uses `window.location.origin` today).
- **Sending invitations** (see phase 7): the system share sheet and the
  contacts picker, so a creator sends each voter their link in a tap or two.
- The Android back button, the status bar colour, and the Capacitor share
  plugin where `navigator.share` is missing.

## Scale

Goal: the open-source answer to "can it take a billion ballots on one poll?"
is yes, measured. The first step is done (phase 5b, numbers in
[PERFORMANCE.md](PERFORMANCE.md#ballots-at-scale)): a poll costs the same to
read and to vote on at 10 million ballots as at ten, and one laptop records
thousands of ballots a second. Next, in order:

- **Live updates across servers.** Folding already runs on every server side
  by side; watchers only hear of their own server's folds. Relay "this poll
  moved" through PostgreSQL `LISTEN/NOTIFY` (or Redis) so that any server can
  push it.
- **Results for millions of watchers.** A poll's update is the same for every
  watcher: serve it as `GET /api/polls/{id}/results` with
  `Cache-Control: max-age=1` behind a CDN, and keep server-sent events for
  small audiences.
- **A load test in CI** on PostgreSQL, with a regression threshold, so that
  "it scales" stays true: `perf/Load.java` already drives it.
- **Beyond one database server.** Split ballots by voter (Citus, with the
  ballot key as the shard key) and fold per shard; the counters stay one
  small table per poll.
- **Identity at scale.** One cookie per browser lets anyone vote twice by
  clearing it. A billion-ballot poll needs accounts or invitations (phase 7),
  or proof of personhood, and rate limits per network: of all the limits, this is the
  one technology alone does not remove.

## Questions for the owner

Choices that change results or meaning, deliberately left as they are:

1. **Unrated means Bad.** On a live ballot, rating one option counts every
   unrated option as `Bad` until the voter rates it. That is the method's
   convention, and the ballot says so, but it can surprise.
2. **Results before voting.** On a live poll, results are visible before you
   vote, which can anchor voters. "At close" exists now (below); "after
   voting" would be simple to add, but it shows a voter the tallies just
   before and after their own ballot.

Decided:

- Live results (2026-10-05, 2026-10-06): the creator chooses, once, when
  results show: live (with a warning), once a number of ballots are in (3 at
  least, 5 offered), or at close. Live tallies show what each voter chose to
  whoever watches them land, so polls showing names wait for closing unless
  the creator asks otherwise. Until then, only the number of ballots shows,
  to everyone, the creator included.
- A counted ballot starts hidden (2026-10-06), on every screen size, behind
  "Change my ballot": a projector or a shoulder is not a receipt.
- Closing is final (2026-10-06): a closed poll cannot be reopened, and the
  creator confirms after a warning saying so. Final results stay final, and
  results kept for the closing cannot be peeked at.

- With an even number of ballots, the majority mention is the lower of the two
  middle mentions (classic majority judgment), so five `Excellent` and five
  `Bad` make `Bad`.
- The grey palette is seven greys evenly spaced in perceived lightness,
  lighter is better, defined once (`mentions.css`) for the results and the
  ballots.
- Ties (2026-09-26): options with the same majority mention are ranked by the
  GMJ "usual judgment" score (Fabre, *Social Choice and Welfare*, 2021), and
  nothing else. The score is computed exactly, from the counts, so equal
  scores are equal numbers. Options still tied are shown ex aequo, with the
  same rank: no hidden second rule, and the order in which the options were
  listed never decides a rank (tied options only keep it on screen). Other
  tie-breaks (Balinski and Laraki's majority value, typical or central
  judgment) favour different parts of the distribution and can disagree. If
  single-winner polls come, break the tie in the open: a runoff between the
  tied options, or a public draw.
