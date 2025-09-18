# SpacetimeDB Test Scripts

This folder contains ad-hoc bash scripts to exercise the SpacetimeDB module reducers and DB state.

## Prerequisites
- SpacetimeDB CLI installed: https://spacetimedb.com/install
- Module published (default name: `zvote-proto1`). From the repo root:
  ```bash
  ./proto1/start_and_publish_db.sh
  ```
  To expose the server on LAN:
  ```bash
  SPACETIME_START_ARGS="--bind 0.0.0.0:3000" ./proto1/start_and_publish_db.sh
  ```
- Optional: configure a server alias (recommended)
  ```bash
  spacetime server add local http://127.0.0.1:3000
  spacetime server set-default local
  ```

## Environment variables
- `MODULE` — module name (default: `zvote-proto1`)
- `SERVER_ALIAS` — spacetime CLI server alias (e.g., `local`). If set, scripts use `spacetime --server "$SERVER_ALIAS" ...`.

Examples:
```bash
MODULE=zvote-proto1 SERVER_ALIAS=local ./run_all.sh
./test-create-votes.sh
./test-approvals.sh
./test-limits.sh
./test-public-filters.sh
```

## Scripts
- `lib.sh` — shared helpers wrapping `spacetime call/sql`, JSON quoting, etc.
- `test-create-votes.sh` — creates a couple of votes (public and private) and lists them.
- `test-approvals.sh` — creates a vote, approves/unapproves options, and displays counts.
- `test-limits.sh` — verifies that over-limit options are truncated to the server limit.
- `test-public-filters.sh` — seeds public/private votes, shows counts by visibility. Uses `reset_db` to clear tables first.
- `run_all.sh` — runs the above tests in a sequence.

## Notes
- The server now stores limits in a public `server_info` table. The `ensure_server_info` reducer seeds a singleton row; it’s idempotent and safe to call.
- The client reads this table and adjusts the UI limit dynamically.
- All tests are non-destructive, except `test-public-filters.sh` which clears data via `reset_db` for reproducibility.
