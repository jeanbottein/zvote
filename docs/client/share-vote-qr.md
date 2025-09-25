# Share Vote via QR

- **Persona**: Organizer or participant
- **Goal**: Share the vote easily with others using a QR code that encodes the share link.
- **Desired outcome/flow**:
  - On the vote detail page, a QR code is available for the vote link.
  - Scanning the QR code opens the vote page (including token for unlisted/private where applicable).

## Acceptance criteria
- **QR correctness**: The QR code encodes the exact share URL.
- **Usability**: QR is scannable on common devices; supports dark/light backgrounds.
- **Security**: For unlisted/private votes, the QR must include the token; do not expose any personal data.

## Related
- [Token Generation (Unlisted/Private)](../server/token-generation-unlisted-and-private.md)
- [Visibility Model](../server/visibility-model.md)

## TODO / Questions
- Should we allow printing or downloading the QR for offline sharing?
