# Create Public Vote

- **Persona**: Authenticated voter/organizer
- **Goal**: Create a vote visible to everyone without needing a share link.
- **Desired outcome/flow**:
  - Open the Create Vote form.
  - Enter a non-empty title and optional description.
  - Choose visibility = Public.
  - Choose a voting system (Approval or Majority Judgment) after reading its brief explanation.
  - Provide at least two non-empty, unique options.
  - Submit to create the vote and see it listed under “My votes” and “Public votes”.

## Acceptance criteria
- **Title required**: Vote cannot be created with an empty title.
- **Options validation**: At least two options; duplicates (case-insensitive) are rejected; empty strings are rejected; maximum options respected.
- **System selection**: One (and only one) voting system must be selected.
- **Visibility**: Vote appears to all users under Public votes.
- **Confirmation & navigation**: After creation, the user can access the vote detail page and copy/share its link and QR.

## Related
- [Vote Creation Validation and Limits](../server/vote-creation-validation-and-limits.md)
- [Visibility Model](../server/visibility-model.md)
- [Voting Systems](../server/voting-systems.md)
- [Share Vote via QR](./share-vote-qr.md)

## TODO / Questions
- Is description mandatory or optional? (Currently treated as optional.)
- Should there be a hard limit on options visible in the form before scrolling?
