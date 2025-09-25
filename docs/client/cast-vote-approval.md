# Cast Vote (Approval)

- **Persona**: Participant
- **Goal**: Approve one or more options quickly.
- **Desired outcome/flow**:
  - On the vote page, click options to toggle approval on/off.
  - My own approvals are shown clearly and can be withdrawn individually or all-at-once.
  - Counts update live.

## Acceptance criteria
- **Toggle**: Clicking an option adds/removes my approval.
- **State**: My current approvals are highlighted and persist on reload.
- **Withdraw**: A “withdraw my vote” action removes all my approvals for this vote.
- **Privacy**: I never see other users’ approvals; only aggregated counts.

## Related
- [Reducer API](../server/reducer-api.md)
- [Aggregation Strategy](../server/aggregation-strategy.md)
- [Privacy and Data Exposure Policy](../server/privacy-and-data-exposure-policy.md)
