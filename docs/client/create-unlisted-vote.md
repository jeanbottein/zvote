# Create Unlisted Vote

- **Persona**: Authenticated voter/organizer
- **Goal**: Create a vote accessible only via a secret link (not discoverable in public listings).
- **Desired outcome/flow**:
  - In Create Vote form, select visibility = Unlisted.
  - Upon creation, system generates a unique, hard-to-guess token and a shareable link.
  - Organizer shares the link with intended participants.

## Acceptance criteria
- **Not discoverable**: The vote does not appear in public listings.
- **Shareability**: A short, URL-safe token is generated and included in the link.
- **Access**: Anyone with the link can view and participate.

## Related
- [Visibility Model](../server/visibility-model.md)
- [Token Generation (Unlisted/Private)](../server/token-generation-unlisted-and-private.md)

## TODO / Questions
- Should link shortening or custom aliases be supported?
- Are rate limits needed for link sharing to mitigate abuse?
