# My Votes List

- **Persona**: Authenticated voter/organizer
- **Goal**: See all votes created by me (Public, Unlisted, Private) in one place.
- **Desired outcome/flow**:
  - “My votes” section displays all my created votes, sorted newest first.
  - Shows basic details (title, visibility badge) and quick actions (open, vote, share).
  - If more than 10 items, the section is scrollable.
  - If a participant limit is known, show it as “(current/limit)” next to participants count.

## Acceptance criteria
- **Scope**: Only votes created by the current user are shown.
- **Sorting**: Newest first.
- **Usability**: Scroll UI appears when count > 10.
- **Counts**: Participant totals visible; if a limit exists, show “(X/Y)”.

## Related
- [Data Model and Tables](../server/data-model-and-tables.md)
- [Aggregation Strategy](../server/aggregation-strategy.md)

## TODO / Questions
- Is there a defined participant limit per vote? If so, how is it set and exposed?
- Confirm how “participants” are calculated (approvals vs judgments).
