# Voting Systems

- **Business rule**: A vote is created with a single voting system which determines how participants express preferences and how results are aggregated.

## Systems
- **Approval**
  - Participants approve zero or more options.
  - Result metric: per-option total approvals.
- **Majority Judgment (MJ)**
  - Participants assign a mention (Bad, Passable, Good, VeryGood, Excellent) to each option.
  - Result metric: per-option majority (median) mention; secondary mentions support tie-breaking among winners.

## Why
- Different decision contexts require different trade-offs: simplicity (Approval) vs quality discrimination (MJ).

## Acceptance criteria
- A vote must specify its voting system at creation and cannot be ambiguous.
- Aggregation is aligned with the chosen system (approval counts vs MJ summaries).
- Client UX clearly communicates the chosen system and how to vote.

## Related
- [Aggregation Strategy](./aggregation-strategy.md)
- [Majority Judgment Tie-breaking](./majority-judgment-tie-breaking.md)
- [Reducer API](./reducer-api.md)
