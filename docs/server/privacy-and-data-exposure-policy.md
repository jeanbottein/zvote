# Privacy and Data Exposure Policy

## Principles
- Individual votes (approvals and judgments) are private. No client may read other users’ raw voting records.
- Only aggregated results are public.
- Users may see their own voting records to populate UX state.

## What
- **Private tables**: `approval`, `judgment`.
- **Public tables**: `vote`, `vote_option`, `mj_summary`, `server_info`.
- **Aggregates**:
  - Approval totals are stored on `vote_option.approvals_count`.
  - MJ distributions and medians are stored in `mj_summary`.

## Why
- Protects voter anonymity while enabling transparent aggregated results.

## Acceptance criteria
- No API or subscription exposes another user’s `approval` or `judgment` rows.
- Users can see their own `approval`/`judgment` rows for the current vote context to render their local selections.
- Public pages rely solely on aggregates for counts and distributions.

## Related
- [Aggregation Strategy](./aggregation-strategy.md)
- [Data Model and Tables](./data-model-and-tables.md)
- [Access Control for Private Votes](./access-control-private-votes.md)

## TODO / Questions
- Define explicit client authorization policies for Private votes (e.g., session vs token plus ACL).
