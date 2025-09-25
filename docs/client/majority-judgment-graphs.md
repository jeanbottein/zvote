# Majority Judgment Graphs

- **Persona**: Visitor or participant
- **Goal**: Understand the distribution of judgments for each option in an MJ vote at a glance.
- **Desired outcome/flow**:
  - On the vote page, view a clear, color-coded breakdown of mentions for each option.
  - See total judgments and the computed majority (median) mention for each option.
  - Graphs update live as participants cast or change judgments.

## Acceptance criteria
- **Clarity**: Each mention category (ToReject → Excellent) is clearly distinguished.
- **Totals**: Show per-option totals and majority mention; optionally display the “second” mention for tie explanations.
- **Real-time**: Changes appear without refresh while the page remains open.
- **Privacy**: Graphs never expose individual voters; only aggregated counts are shown.

## Related
- [Cast Vote (Majority Judgment)](./cast-vote-majority-judgment.md)
- [Aggregation Strategy](../server/aggregation-strategy.md)
- [Majority Judgment Tie-breaking](../server/majority-judgment-tie-breaking.md)
