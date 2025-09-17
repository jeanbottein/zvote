# PROTO1 — Approval Voting on SpacetimeDB

This prototype implements a live approval-voting backend on SpacetimeDB. It lets any user:

- Create a vote (with up to 20 options)
- Approve multiple options and change approvals at any time
- View results (options sorted by number of approvals)
- Delete a vote (creator only)

Everything is realtime and transactional thanks to SpacetimeDB reducers and tables.

## Module location

- Server module: `proto1/server/`
- Main file: `proto1/server/src/lib.rs`

## Data model (tables)

- `vote` (public)
  - `id: u64` — auto-increment primary key
  - `creator: Identity` — creator of the vote
  - `title: String`
  - `public: bool` — whether clients can read it; currently informational for future privacy
  - `created_at: Timestamp`
  - Indexes: `by_creator(creator)`, `by_creator_and_created(creator, created_at)`

- `vote_option` (public)
  - `id: u32` — auto-increment primary key
  - `vote_id: u64` — FK to `vote.id`
  - `label: String`
  - `approvals_count: u32` — denormalized counter for fast ranking
  - `order_index: u32` — original order
  - Indexes: `by_vote(vote_id)`, `by_vote_and_label(vote_id, label)`, `by_vote_and_count(vote_id, approvals_count)`

- `approval` (public)
  - `vote_id: u64`
  - `option_id: u32`
  - `voter: Identity`
  - `ts: Timestamp` — last change time for this voter/option
  - Indexes: `by_vote(vote_id)`, `by_vote_and_option(vote_id, option_id)`, `by_vote_and_voter(vote_id, voter)`, `by_vote_voter_option(vote_id, voter, option_id)`

Notes:

- SpacetimeDB tables are set-semantic. Inserting an exact duplicate row is a no-op. We still use indexes to query/update efficiently.
- We maintain `approvals_count` in `vote_option` for fast results; it is updated transactionally in reducers.

## Reducers (server-side API)

- `create_vote(ctx, title: String, options: Vec<String>, public: Option<bool>) -> Result<(), String>`
  - Validates title and options (1..=20, normalized, deduped)
  - Inserts `vote` and associated `vote_option` rows

- `delete_vote(ctx, vote_id: u64) -> Result<(), String>`
  - Only the creator can delete
  - Deletes `approval` rows, `vote_option` rows, then the `vote`

- `approve(ctx, vote_id: u64, option_id: u32) -> Result<(), String>`
  - Approves a single option; idempotent
  - Inserts into `approval` and increments the option’s `approvals_count`

- `unapprove(ctx, vote_id: u64, option_id: u32) -> Result<(), String>`
  - Removes approval if present; idempotent
  - Deletes from `approval` and decrements the option’s `approvals_count`

- `set_approvals(ctx, vote_id: u64, option_ids: Vec<u32>) -> Result<(), String>`
  - Replaces the caller’s entire approval set for a vote in one transaction
  - Validates that all `option_ids` belong to the vote (max 20)

## Local setup

1) Install Rust (cargo + rustup):

   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
   ```

   If needed in your current shell:

   ```sh
   source "$HOME/.cargo/env"
   ```

2) Install the wasm32 target:

   ```sh
   rustup target add wasm32-unknown-unknown
   ```

3) Start SpacetimeDB locally (in a separate terminal):

   ```sh
   spacetime start
   ```

4) Build the module:

   ```sh
   cd proto1/server
   spacetime build
   ```

5) Publish the module (choose a unique name, e.g. `zvote-proto1`):

   ```sh
   spacetime publish --project-path proto1/server zvote-proto1
   ```

## Using the CLI

Assuming your module name is `zvote-proto1`.

- Create a vote with options:

  ```sh
  spacetime call zvote-proto1 create_vote '"Lunch poll"' '["Pizza","Sushi","Salad"]' true
  ```

- Approve an option (vote_id=1, option_id=2):

  ```sh
  spacetime call zvote-proto1 approve 1 2
  ```

- Unapprove an option:

  ```sh
  spacetime call zvote-proto1 unapprove 1 2
  ```

- Replace your full approval set:

  ```sh
  spacetime call zvote-proto1 set_approvals 1 '[2,3]'
  ```

- Delete a vote (creator only):

  ```sh
  spacetime call zvote-proto1 delete_vote 1
  ```

## Viewing results

- Sorted by approvals using the denormalized counter:

  ```sh
  spacetime sql zvote-proto1 "SELECT id, label, approvals_count FROM vote_option WHERE vote_id = 1 ORDER BY approvals_count DESC, order_index ASC"
  ```

You can also browse raw approvals:

```sh
spacetime sql zvote-proto1 "SELECT vote_id, option_id, voter, ts FROM approval WHERE vote_id = 1"
```

## Next steps

- Private votes: enforce read restrictions and invite lists
- Ownership/admin controls: transfer, close, freeze
- Anti-spam/rate limits and optional identity verification
- Pagination and richer query reducers for large votes
- Client app (TypeScript/Rust) using generated bindings

