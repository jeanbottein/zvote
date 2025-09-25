# Create Private Vote

- **Persona**: Authenticated voter/organizer
- **Goal**: Create a vote visible and accessible only to explicitly allowed participants.
- **Desired outcome/flow**:
  - In Create Vote form, select visibility = Private.
  - Organizer defines allowed participants (e.g., by identity list, invitations, or access policy).
  - Only allowed participants can see/vote; others cannot access even with a link.

## Acceptance criteria
- **Visibility**: Vote is hidden from public listings and from non-allowed users.
- **Access control**: Only allowed participants can view details or vote.
- **Share**: Private link may still be used, but access enforcement blocks non-authorized users.

## Related
- [Visibility Model](../server/visibility-model.md)
- [Access Control for Private Votes](../server/access-control-private-votes.md)

## TODO / Questions
- Exact mechanism for defining allowed participants (whitelist, invites, groups) TBD.
- What error/UX do non-authorized users see?
- Should organizers be able to update the allowed list post-creation?
