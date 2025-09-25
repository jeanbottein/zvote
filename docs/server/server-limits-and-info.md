# Server Limits and Info

## What
- The server exposes a public information record with constraints that the client can use to guide UX.
- Example: maximum number of options per vote.

## Why
- Clients need to enforce or communicate server-side limits to users to prevent invalid submissions.

## Acceptance criteria
- **Availability**: A public info record is available to clients via subscription.
- **Consistency**: The same limits are enforced on the server for all reducers.
- **UX**: Clients surface these limits in the UI (e.g., disabling extra option fields).

## Related
- [Vote Creation Validation and Limits](./vote-creation-validation-and-limits.md)
- [Data Model and Tables](./data-model-and-tables.md)
