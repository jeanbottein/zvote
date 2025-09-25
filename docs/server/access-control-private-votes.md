# Access Control for Private Votes

## What
- Private votes are visible and accessible only to authorized participants.
- Authorization model defines how the server recognizes who can view or participate (e.g., identity lists, invitations, or group membership).

## Why
- Protects sensitive decisions from uninvited participants, even if a link is shared.

## Acceptance criteria
- **Visibility**: Private votes do not appear in public listings or to unauthorized users.
- **Enforcement**: Attempting to access a private vote without authorization is blocked.
- **Auditability**: The policy is explicit and testable.

## Related
- [Visibility Model](./visibility-model.md)
- [Privacy and Data Exposure Policy](./privacy-and-data-exposure-policy.md)

## TODO / Questions
- Define the exact authorization mechanism (ACL, invite links, group policies).
- Decide whether organizers can modify access lists post-creation.
