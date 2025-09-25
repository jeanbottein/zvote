# Withdraw My Participation

- **Persona**: Participant
- **Goal**: Remove all my recorded votes from a particular vote.
- **Desired outcome/flow**:
  - From the vote page, select an action to withdraw my vote.
  - For Approval: removes all my approvals on all options.
  - For Majority Judgment: removes all my judgments on all options.
  - Aggregated counts update accordingly.

## Acceptance criteria
- **Action**: A single action withdraws my full participation for the vote.
- **Feedback**: UI confirms success; aggregated results reflect the change.
- **Privacy**: My individual votes remain private; only aggregates change.

## Related
- [Reducer API](../server/reducer-api.md)
- [Aggregation Strategy](../server/aggregation-strategy.md)
- [Privacy and Data Exposure Policy](../server/privacy-and-data-exposure-policy.md)
