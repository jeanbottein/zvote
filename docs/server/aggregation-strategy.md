# Aggregation Strategy

## What
- **Approval voting**: Per-option approval totals are maintained in a public aggregate field (`approvals_count` on the option) so clients can show counts without exposing individual approvals.
- **Majority Judgment (MJ)**: Per-option distributions are stored in a public summary (`mj_summary`) including counts per mention, total judgments, the majority (median) mention, and an optional second mention for tie-breaking among winners.

## Why
- Enables real-time result displays without leaking individual voter data.
- Allows clients to subscribe to public summaries and stay synced live.

## Acceptance criteria
- **Accuracy**: Aggregates reflect changes immediately after voting actions (approve/unapprove; cast/withdraw judgments).
- **Privacy**: No individual voter data is exposed; only aggregates are public.
- **Live updates**: Subscribed clients receive updates without manual refresh.

## Related
- [Data Model and Tables](./data-model-and-tables.md)
- [Voting Systems](./voting-systems.md)
- [Majority Judgment Tie-breaking](./majority-judgment-tie-breaking.md)
- [Privacy and Data Exposure Policy](./privacy-and-data-exposure-policy.md)
