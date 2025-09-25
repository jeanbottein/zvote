# Create Vote Form (Fields & UX)

- **Persona**: Authenticated voter/organizer
- **Goal**: Fill in all required fields to create a new vote comfortably and correctly.
- **Desired outcome/flow**:
  - Fields: title (required), description (optional), visibility (Public/Unlisted/Private), voting system (Approval/Majority Judgment), options list.
  - Options UX: Add new option by pressing Enter in the last field or clicking “Add option.” Remove buttons are shown when there are more than two options.
  - Voting system selection has a brief italic explanation of when to use each system.
  - Submit button is enabled only when validation passes.

## Acceptance criteria
- **Validation**: Title non-empty; ≥2 unique options; each option non-empty; respects max option limit.
- **Visibility control**: User can pick Public, Unlisted, or Private.
- **System control**: User must select exactly one system.
- **Clarity**: Brief guidance text distinguishes Approval (simplicity) vs MJ (quality-focused).

## Related
- [Vote Creation Validation and Limits](../server/vote-creation-validation-and-limits.md)
- [Visibility Model](../server/visibility-model.md)
- [Voting Systems](../server/voting-systems.md)
- [Token Generation (Unlisted/Private)](../server/token-generation-unlisted-and-private.md)

## TODO / Questions
- Confirm whether description is stored server-side; if not, mark as future enhancement.
- Confirm the exact maximum number of options communicated to users.
