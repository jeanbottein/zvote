# Results Sorting (Majority Judgment)

- **Persona**: Visitor or participant
- **Goal**: See options ranked from highest to lowest according to majority judgment, with clear tie-handling.
- **Desired outcome/flow**:
  - Options are displayed in order of their majority (median) mention.
  - If multiple options tie at the top majority mention, break ties using the secondary measure ("second" mention) iteratively.
  - If options remain tied after tie-breaking, mark them equal.

## Acceptance criteria
- **Ordering**: The ordering reflects the majority mention and uses iterative tie-breaking across mentions.
- **Explanations**: UI shows the majority mention for each option and can indicate tie steps.
- **Consistency**: Sorting in both voting and view modes is consistent.

## Related
- [Majority Judgment Tie-breaking](../server/majority-judgment-tie-breaking.md)
- [Majority Judgment Graphs](./majority-judgment-graphs.md)
