# zvote: handoff

**Updated 2026-09-24.** For whoever picks this up next, human or agent. Read
`CLAUDE.md` first (conventions and traps), then `docs/ARCHITECTURE.md` and
`docs/ROADMAP.md`. This file only says where things stand.

## State

The migration away from SpacetimeDB is complete. There is one backend, the
Java server, and the web client was rebuilt against it, mobile first. Phases
0 to 4 of the roadmap are done; **phase 5, accounts and social sign-in, is
next.**

The work is committed on the branch `feat/java-server-mobile-web` (not merged,
not pushed), in logical steps: server, web client, dev tooling, docs, then the
fixes the owner asked for.

## Obsolete files: removed

The SpacetimeDB module and scripts, the stale docs and the previous client
code (170 files) were removed on 2026-09-25. `./dev.sh test` passes on the
whole repo: server tests, and client lint, types and tests.

## Verified

- **Server**: 56 tests pass (`./mvnw test`, about 10 s): ArchUnit rules; the
  whole HTTP contract through MockMvc; the live stream over a real socket. By
  hand, over real HTTP: 30 simultaneous ballots from one voter gave 9 × 200
  and 21 × 409 and a consistent final state; shutdown with a watcher
  connected takes 0.08 s; timestamps survive the database in a non-UTC
  timezone.
- **Client**: 92 tests pass (`npm test`); typecheck and lint are clean. The
  production bundle holds no SpacetimeDB or GraphQL code, and no dev tool.
- **End to end**, in headless Chrome with two independent voters (phone
  390 × 844 and desktop 1280 × 900), 23 checks: creating a poll, live ballots,
  one voter's ballot reaching the other without a reload, a burst of 40 ballots
  arriving as one update, envelope mode, dropdown ballots, the grey palette,
  settings, sharing, approval voting, unlisted polls kept off the home page,
  closing and deleting seen live by the other voter, the not-found page, no
  horizontal scrolling on the phone. The acceptance test of the migration
  holds: `MajorityJudgmentResultsGraph` renders live results from the Java
  server, and the component was not modified.

## Decisions made in this pass (reversible)

- Spring Boot 3.4 → 4.1 (3.x is out of open-source support). Java 21 kept.
- Client: React 19, Vite 8, TypeScript 6, Vitest (replacing Jest), ESLint 10,
  react-router 7. Node 24 pinned; everything also runs on the Node 20.19 this
  machine has.
- `PRIVATE` visibility removed until accounts exist ("only people I choose"
  cannot be implemented without them). The `poll_access` table went with it,
  so reading a poll no longer writes anything.
- Closing and reopening polls; RFC 9457 errors; hashed voter ids; poll limits
  enforced from configuration; ballots must match their poll (400 otherwise,
  where foreign option ids used to be silently dropped).
- The unenforceable `liveBallot` / `envelopeBallot` server flags became what
  they were: the voter's preference, in Settings.
- Toasts moved to the top of the screen: at the bottom they covered the
  delete confirmation on phones.

## Open questions for the owner

See the end of `docs/ROADMAP.md`: "unrated means Bad", and results visible
before voting. Settled since: the majority mention of an even number of
ballots is the lower middle one (classic majority judgment), and the grey
palette is an even lightness ramp.
