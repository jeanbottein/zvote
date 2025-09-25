# Reducer API (Server Actions)

## What
- Actions exposed to clients to perform voting and management tasks.

### Vote Management
- **create_vote**: Create a vote with title, options, visibility, and voting system.
- **delete_vote**: Delete a vote (creator-only).
- **ensure_server_info**: Seed or refresh server-side limits/config row.

### Approval Voting
- **approve**: Add the caller’s approval for a specific option in an approval-based vote.
- **unapprove**: Remove the caller’s approval.
- **set_approvals**: Replace the caller’s entire approval set for a vote with the provided option list.

### Majority Judgment
- **cast_judgment**: Set or update the caller’s judgment (mention) for a specific option; on first interaction, default entries may be created for all options.
- **withdraw_judgments**: Remove all of the caller’s judgments for a given vote.

## Why
- Reducers encapsulate business rules and enforce data validation and privacy policies on the server.

## Acceptance criteria
- **Validation**: Reducers validate inputs (e.g., option belongs to vote, correct system).
- **Privacy**: Reducers never leak other users’ data; only the caller’s state is modified or read where needed to compute aggregates.
- **Aggregates**: Reducers update public aggregates so clients can observe results without accessing private data.

## Related
- [Vote Creation Validation and Limits](./vote-creation-validation-and-limits.md)
- [Aggregation Strategy](./aggregation-strategy.md)
- [Privacy and Data Exposure Policy](./privacy-and-data-exposure-policy.md)
