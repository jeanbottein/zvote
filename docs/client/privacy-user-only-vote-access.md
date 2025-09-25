# Privacy: User-Only Vote Access

- **Persona**: Participant
- **Goal**: Trust that my individual votes (approvals/judgments) remain private while seeing my own choices reflected in the UI.
- **Desired outcome/flow**:
  - UI shows my selections (approvals/judgments) when I view a vote.
  - UI never reveals any other user’s selections.
  - Aggregated results remain visible.

## Acceptance criteria
- **Isolation**: My private records are accessible only to me, scoped to the vote I’m viewing.
- **Aggregates**: Counts and distributions shown in the UI come from public aggregates only.
- **Compliance**: Client follows privacy rules at all times, including in real-time updates.

## Related
- [Privacy and Data Exposure Policy](../server/privacy-and-data-exposure-policy.md)
- [Aggregation Strategy](../server/aggregation-strategy.md)
