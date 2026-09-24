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

## Next

### 5. Accounts and social sign-in

Goal: sign in with Google, Apple and other OpenID Connect providers, keep
ballots cast before signing in, and make private polls possible.

- **Server.** Add `spring-boot-starter-security-oauth2-client` and let Spring
  Security run the OpenID Connect login (`/oauth2/authorization/{provider}`),
  with a server-side session in an HttpOnly cookie. Tokens never reach the
  page's JavaScript. Add an `account` table (provider, subject, created) and a
  `/api/me` endpoint.
- **One place for identity.** `VoterIdentityFilter` resolves the signed-in
  account first and the anonymous token second. Everything else keeps using
  the voter id it puts on the request.
- **Keep the anonymous past.** At sign-in, move the anonymous voter's ballots
  and polls onto the account: one transaction updating `voter_id` and
  `creator_id`. Where both identities voted on the same poll, keep the most
  recent ballot. Without this, ballots cast before signing in are orphaned.
- **Private polls.** Bring back `PRIVATE` visibility: only listed accounts (or
  a group) can open the poll. The check belongs in `PollService.find`, where
  visibility rules live.
- **Rich links.** When a poll's link is pasted into a chat, show its title and
  a preview image (Open Graph tags). That needs the server to render
  `index.html` for `/p/{id}`, which it can once it serves the client (see
  phase 8).
- **Client.** A sign-in button that simply navigates to the provider (no
  client-side OAuth), the account in the settings sheet, sign-out.

### 6. Installable web app

Web app manifest and icons, a service worker that caches the shell so the app
opens offline and says so, and an install prompt. The layout is already built
for phones (safe areas, touch targets, bottom sheets).

### 7. Android app (Capacitor)

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
- The Android back button, the status bar colour, and the Capacitor share
  plugin where `navigator.share` is missing.

### 8. Deployment

- **PostgreSQL** (add `org.flywaydb:flyway-database-postgresql`), with a
  Testcontainers PostgreSQL profile in CI. Locally H2 stays, so nothing needs
  installing.
- **GraalVM native image**, together with PostgreSQL (H2 resists native image).
- **One origin.** The server serves the built client, which keeps cookies
  first-party and enables the Open Graph pages above.
- **Hardening.** TLS (the cookie turns `Secure` on its own behind HTTPS), a
  Content Security Policy, and rate limits on poll creation and ballots.
- **Several nodes.** Relay live updates through PostgreSQL `LISTEN/NOTIFY` or
  Redis.
- **End-to-end tests in CI** with Playwright, on a phone viewport and a
  desktop one.

## Questions for the owner

Choices that change results or meaning, deliberately left as they are:

1. **Unrated means Bad.** On a live ballot, rating one option counts every
   unrated option as `Bad` until the voter rates it. That is the method's
   convention, and the ballot says so, but it can surprise.
2. **The grey palette** gives `Good` and `VeryGood` the same grey, and its
   darkest greys nearly vanish on the dark theme's cards. The palette lives in
   the reference stylesheet, so it was left untouched.
3. **Results before voting.** Results are visible before you vote, which suits
   live polls but can anchor voters. A per-poll "show results after voting or
   after closing" option would be simple to add.

Decided: with an even number of ballots, the majority mention is the lower of
the two middle mentions (classic majority judgment), so five `Excellent` and
five `Bad` make `Bad`.
