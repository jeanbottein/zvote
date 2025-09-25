# Majority Judgment Tie-breaking

## What
- Results for Majority Judgment (MJ) are determined by each option’s majority (median) mention.
- When two or more options tie at the highest majority mention, a secondary comparison is used to break the tie.
- The secondary comparison ("second" mention) is computed by effectively removing one instance of the majority mention and recomputing the majority on the reduced set.

## Why
- MJ aims to reflect consensus quality. The secondary measure differentiates options that share the same majority mention by looking at the neighboring distributions.

## Acceptance criteria
- **Majority (median)**: Primary outcome for each option is its median mention.
- **Tie handling**: If there is a tie among options at the top majority mention, compute and use a "second" mention for those tied options to break the tie.
- **Transparency**: The UI can surface both majority and second mentions for clarity.

## Related
- [Voting Systems](./voting-systems.md)
- [Aggregation Strategy](./aggregation-strategy.md)
- [Data Model and Tables](./data-model-and-tables.md)
