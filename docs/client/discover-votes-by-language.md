# Discover Votes by Language

- **Persona**: Visitor or user with language preferences
- **Goal**: Filter public votes to those matching selected languages.
- **Desired outcome/flow**:
  - Choose preferred languages in the UI.
  - See public votes matching those languages.
  - Optionally change language filter at any time.

## Acceptance criteria
- **Filter**: Only public votes with matching language metadata appear.
- **User control**: Users can adjust their language filter and see immediate changes.
- **Fallbacks**: Define behavior for votes without language metadata.

## Related
- [Localization and Language Policy](../server/localization-and-language-policy.md)
- [Visibility Model](../server/visibility-model.md)

## TODO / Questions
- Determine UI for multi-language selection and defaults.
- Define how votes without language metadata are handled (include/exclude).
