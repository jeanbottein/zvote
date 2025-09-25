# Localization and Language Policy

## What
- Votes may include language metadata to support filtering and discovery by language.
- Clients can request to see votes matching user language preferences.

## Why
- Improves relevance and accessibility of public votes across different locales.

## Acceptance criteria
- **Metadata**: Language is stored or inferred for votes when provided.
- **Filtering**: Server supports querying by language for public votes.
- **Override**: Users can change their language filter in the client.

## Related
- [Discover Votes by Language](../client/discover-votes-by-language.md)
- [Visibility Model](./visibility-model.md)

## TODO / Questions
- Define how language is captured at creation (field vs inference) and validated.
- Determine supported locales and fallback strategy.
