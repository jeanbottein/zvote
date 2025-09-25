# Data Model and Tables

## Entities
- **Vote** (public)
  - Represents a single poll with title, visibility, created timestamp, share token, and voting system.
- **VoteOption** (public)
  - Option belonging to a vote, with a server-maintained `approvals_count` aggregate.
- **Approval** (private)
  - One row per (voter, option) for Approval voting. Private to protect voter anonymity.
- **Judgment** (private)
  - One row per (voter, option) for Majority Judgment. Private to protect voter anonymity.
- **MjSummary** (public)
  - Aggregated, per-option judgment counts and computed majority/second mentions for Majority Judgment.
- **ServerInfo** (public)
  - Server configuration (e.g., maximum allowed options) exposed to clients for UX.

## Privacy and exposure
- **Public** tables are readable by clients for discovery and aggregated results.
- **Private** tables are not exposed in general; only the current user’s own rows may be accessed when necessary (e.g., to reflect “my vote”) without exposing others’ votes.

## Acceptance criteria
- **Privacy**: No client can read other users’ individual votes (approvals/judgments).
- **Aggregates**: Approval counts and judgment distributions are available via public aggregates.
- **Discoverability**: Public and unlisted votes are discoverable per the visibility policy.

## Related
- [Visibility Model](./visibility-model.md)
- [Aggregation Strategy](./aggregation-strategy.md)
- [Privacy and Data Exposure Policy](./privacy-and-data-exposure-policy.md)
- [Server Limits and Info](./server-limits-and-info.md)
