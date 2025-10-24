# Backend Abstraction Layer

This directory contains the backend abstraction layer that allows the ZVote client to work with different backend implementations.

## Architecture

```
┌─────────────────────────────────────┐
│         UI Components               │
│  (React, hooks, pages, etc.)        │
└──────────────┬──────────────────────┘
               │
               │ imports getBackend()
               ▼
┌─────────────────────────────────────┐
│      Backend Factory (index.ts)     │
│  - Reads VITE_BACKEND_TYPE config   │
│  - Returns correct implementation   │
│  - Singleton pattern                │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         ▼           ▼
┌──────────────┐  ┌──────────────┐
│ SpacetimeDB  │  │   GraphQL    │
│  Backend     │  │   Backend    │
└──────────────┘  └──────────────┘
```

## Files

### `BackendAPI.ts`
- Defines the `BackendAPI` interface that all backends must implement
- Common types: `Vote`, `VoteOption`, `CreateVoteParams`, etc.
- All backend operations: `getVotes()`, `createVote()`, `approve()`, etc.

### `index.ts` (Backend Factory)
- **`getBackend()`** - Get singleton backend instance
- Automatically selects implementation based on `VITE_BACKEND_TYPE`
- Lazy loads the correct backend module
- Initializes the backend before returning

### `SpacetimeBackend.ts`
- Implementation of `BackendAPI` for SpacetimeDB
- Wraps existing `spacetimeClient.ts`
- Provides real-time updates via subscriptions
- Used when `VITE_BACKEND_TYPE=spacetime`

### `GraphQLBackend.ts`
- Implementation of `BackendAPI` for Java GraphQL server
- Uses HTTP POST to `/graphql` endpoint (proxied by Vite)
- Polling or manual refresh for updates
- Used when `VITE_BACKEND_TYPE=graphql`

## Usage

### In your React components/hooks:

```typescript
import { getBackend } from '@/lib/backend';

// In a component or hook
async function loadVotes() {
  const backend = await getBackend();
  const votes = await backend.getVotes();
  return votes;
}
```

### Don't check backend type in UI code:

❌ **Don't do this:**
```typescript
if (isSpacetimeBackend()) {
  // SpacetimeDB specific code
} else {
  // GraphQL specific code
}
```

✅ **Do this:**
```typescript
const backend = await getBackend();
await backend.approve(voteId, optionId);
```

## Benefits

1. **Single Condition Check**: Backend type is checked once at startup
2. **Clean UI Code**: UI doesn't know which backend is being used
3. **Easy to Switch**: Change `VITE_BACKEND_TYPE` and everything works
4. **Easy to Test**: Mock the `BackendAPI` interface
5. **Type Safe**: All methods are typed via the interface
6. **Extensible**: Easy to add new backend implementations

## Configuration

Set in environment variables or `.env` file:

```bash
# Use SpacetimeDB
VITE_BACKEND_TYPE=spacetime
VITE_BACKEND_PORT=3000
VITE_SPACETIME_DB_NAME=zvote-proto1

# OR use Java GraphQL
VITE_BACKEND_TYPE=graphql
VITE_BACKEND_PORT=8080
```

## Adding a New Backend

1. Create `NewBackend.ts` implementing `BackendAPI`
2. Add to factory in `index.ts`:
   ```typescript
   if (config.backendType === 'newbackend') {
     const { NewBackend } = await import('./NewBackend');
     backendInstance = new NewBackend();
   }
   ```
3. Update config types to include new backend type

## Migration from Old Code

### Old pattern (scattered conditions):
```typescript
// In many files...
if (import.meta.env.VITE_BACKEND_TYPE === 'spacetime') {
  spacetimeDB.approve(voteId, optionId);
} else {
  fetch('/graphql', { /* ... */ });
}
```

### New pattern (centralized):
```typescript
// In one place (backend factory)
const backend = await getBackend();

// Everywhere else
await backend.approve(voteId, optionId);
```
