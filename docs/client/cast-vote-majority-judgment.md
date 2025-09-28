# Cast Vote (Majority Judgment)

- **Persona**: Participant
- **Goal**: Assign a judgment (grade) to each option using a 5-level scale.
- **Desired outcome/flow**:
  - On the vote page, use a slider or labeled buttons to assign one of: Bad, Passable, Good, VeryGood, Excellent.
  - On first interaction in a vote, all options default to a baseline mention; the user then updates specific options.
  - The user’s selections persist on reload and can be changed at any time.

## Acceptance criteria
- **Full coverage**: The user can set (or leave default) a mention for each option.
- **Persistence**: Returning to the vote reflects the user’s previously recorded judgments.
- **Withdraw**: A “withdraw my vote” action clears all the user’s judgments for the vote.
- **Privacy**: The user never sees others’ individual judgments; only aggregated results.

## Related
- [Majority Judgment Graphs](./majority-judgment-graphs.md)
- [Withdraw My Participation](./withdraw-my-participation.md)
- [Reducer API](../server/reducer-api.md)
- [Privacy and Data Exposure Policy](../server/privacy-and-data-exposure-policy.md)

## TODO / Questions
- Confirm the default baseline mention used on first interaction for UX clarity.
