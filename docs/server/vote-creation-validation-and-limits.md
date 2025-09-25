# Vote Creation Validation and Limits

- **Business rule**: New votes must meet validation rules to ensure data quality and a consistent user experience.

## What
- Title must be non-empty (normalized for whitespace).
- Options are normalized, deduplicated case-insensitively, and validated to be non-empty.
- At least two unique options are required to create a vote.
- Options exceeding the server-defined maximum are ignored beyond the limit.
- Each option’s initial approval count is zero and an `order_index` preserves submitted order.

## Why
- Prevents malformed or trivial polls.
- Maintains clean option lists and reliable aggregates.
- Ensures inputs remain concise and manageable.

## Acceptance criteria
- **Normalization**: Title and options are trimmed/normalized consistently.
- **Uniqueness**: Duplicate options (case-insensitive) are rejected or removed, keeping the first occurrence.
- **Minimum**: Vote creation fails if fewer than two valid options remain after cleaning.
- **Maximum**: Options beyond the configured maximum are safely truncated.

## Related
- [Server Limits and Info](./server-limits-and-info.md)
- [Data Model and Tables](./data-model-and-tables.md)
- [Visibility Model](./visibility-model.md)
- [Voting Systems](./voting-systems.md)

## TODO / Questions
- Document whether description is persisted and validated (if/when implemented).
- Define UX feedback for rejected/trimmed options.
