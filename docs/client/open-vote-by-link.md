# Open Vote by Link (Token)

- **Persona**: Visitor or participant
- **Goal**: Access a vote directly from a shared URL containing a token (Unlisted/Private) or a public link.
- **Desired outcome/flow**:
  - User opens a link to a vote page with `?token=...`.
  - The app resolves the token, loads the vote, and displays its details and voting controls.
  - If access is restricted (Private), non-authorized users are blocked.

## Acceptance criteria
- **Token handling**: The app recognizes the token and scopes data to the corresponding vote.
- **Access control**: Private votes enforce authorization before showing details.
- **UX**: Clear error/empty states for invalid or revoked tokens.

## Related
- [Token Generation (Unlisted/Private)](../server/token-generation-unlisted-and-private.md)
- [Visibility Model](../server/visibility-model.md)
