# Token Generation (Unlisted and Private)

- **Business rule**: Unlisted and Private votes require a non-guessable share token to control discovery and access.

## What
- A unique, URL-safe token is generated at vote creation.
- Token is used to build the shareable link for Unlisted and Private votes.
- Token uniqueness is enforced; collisions are avoided by re-computation when necessary.

## Why
- Tokens are the only way to reach Unlisted votes without directory exposure.
- Tokens prevent enumeration and accidental discovery of Private votes (alongside authorization).

## Acceptance criteria
- **Uniqueness**: No two votes share the same token.
- **URL-safety**: Token is base64url-safe (no padding) and short enough to be shareable.
- **Non-guessable**: Token generation uses strong hashing of stable data and entropy (e.g., salt) to avoid predictability.

## Related
- [Visibility Model](./visibility-model.md)
- [Access Control for Private Votes](./access-control-private-votes.md)
- [Data Model and Tables](./data-model-and-tables.md)

## TODO / Questions
- Define maximum and minimum token lengths and whether custom aliases are supported.
- Consider token rotation policy if a link is leaked.
