# Client Configuration Guide

This document explains how to configure client-side features in ZVote.

## Configuration File

Location: `src/config.ts`

This file contains client-side feature flags that are separate from server capabilities.

## Development Tools

### Ballot Feeder (Dev Tool)

The DevBallotFeeder component helps with testing by automatically generating ballots.

**Configuration:**

```typescript
export const DEV_TOOLS = {
  // Enable the DevBallotFeeder component (for testing)
  ENABLE_BALLOT_FEEDER: true,
  
  // Show ballot feeder only for user's own votes
  ONLY_OWN_VOTES: true,
};
```

**Options:**

- **ENABLE_BALLOT_FEEDER:** `true` | `false`
  - Set to `false` to completely hide the ballot feeder
  - Default: `true`

- **ONLY_OWN_VOTES:** `true` | `false`
  - When `true`: Ballot feeder only appears on votes you created
  - When `false`: Ballot feeder appears on all votes
  - Default: `true`

**Usage:**

The ballot feeder automatically checks both conditions:
1. Is the feature enabled in config?
2. Does the current user own this vote? (if ONLY_OWN_VOTES is true)

If both conditions pass, the ballot feeder is displayed.

## UI Configuration

```typescript
export const UI_CONFIG = {
  // Show detailed debug information in console
  DEBUG_MODE: false,
  
  // Enable experimental features
  EXPERIMENTAL_FEATURES: false,
};
```

## How to Modify

1. Open `src/config.ts`
2. Change the desired values
3. Save the file
4. Rebuild the client: `npm run build`
5. The changes take effect immediately

## Production Recommendations

For production deployments:

```typescript
export const DEV_TOOLS = {
  ENABLE_BALLOT_FEEDER: false,  // Hide dev tools
  ONLY_OWN_VOTES: true,
};

export const UI_CONFIG = {
  DEBUG_MODE: false,              // No console spam
  EXPERIMENTAL_FEATURES: false,   // Stable features only
};
```

## Server vs Client Configuration

**Server Configuration** (`server/src/vote.rs`):
- Controls what features the server supports
- Enforces capabilities (visibility, voting systems, ballot modes)
- Published to clients via ServerInfo table

**Client Configuration** (`client/src/config.ts`):
- Controls client-only features (dev tools, UI options)
- Does NOT affect server behavior
- Not published anywhere

Both work together to create a flexible, secure system.
