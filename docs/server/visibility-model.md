# Visibility Model

- **Business rule**: Every vote has a visibility setting that governs discoverability and access.
- **Values**:
  - Public: Discoverable by anyone and listed under Public votes.
  - Unlisted: Not listed publicly; accessible to anyone who has the share link (token in URL).
  - Private: Not listed publicly; only authorized participants can view and vote.

## Purpose / Why
- **Public** enables community-wide participation and transparency.
- **Unlisted** enables limited sharing without directory exposure.
- **Private** ensures restricted access to sensitive or closed-group decisions.

## Acceptance criteria
- **Public**: Appears in public listings; anyone can open and vote (subject to vote-specific rules).
- **Unlisted**: Does not appear in public listings; works only with a valid token link.
- **Private**: Does not appear in public listings; access must be explicitly granted.
- **Badging**: Client UI displays a clear badge for Public, Unlisted, or Private.

## Related
- [Token Generation (Unlisted/Private)](./token-generation-unlisted-and-private.md)
- [Access Control for Private Votes](./access-control-private-votes.md)
- [Data Model and Tables](./data-model-and-tables.md)

## TODO / Questions
- Define the exact authorization model for Private (whitelists, invitations, groups, etc.).
- Clarify whether Unlisted can be converted to Public/Private post-creation and how links behave.
