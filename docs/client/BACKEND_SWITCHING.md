# Backend Configuration

ZVote client supports **either SpacetimeDB or Java GraphQL** backend - chosen at **build time**.

## Build-Time Selection

**Only one backend is compiled into your bundle.** Choose before building:

### Option 1: Environment Files

**Use SpacetimeDB:**
```bash
cp .env.spacetime .env
npm run dev
```

**Use Java GraphQL:**
```bash
cp .env.graphql .env
npm run dev
```

### Option 2: Direct Environment Variables

```bash
# Java GraphQL
VITE_BACKEND_TYPE=graphql VITE_BACKEND_URL=http://localhost:8080 npm run dev

# SpacetimeDB
VITE_BACKEND_TYPE=spacetime npm run dev
```

### Option 3: Convenience Scripts

```bash
npm run dev:spacetime  # Uses .env.spacetime
npm run dev:graphql    # Uses .env.graphql
```

## How It Works

### Tree-Shaking at Build Time
```typescript
// Vite only bundles the code path you need
if (VITE_BACKEND_TYPE === 'graphql') {
  const { GraphQLBackend } = await import('./graphql');
  // SpacetimeBackend code is NOT included in bundle
} else {
  const { SpacetimeBackend } = await import('./spacetime');
  // GraphQLBackend code is NOT included in bundle
}
```

### Unified Interface
All backends implement the same `VoteBackend` interface:

```typescript
interface VoteBackend {
  getVotes(): Promise<Vote[]>;
  createVote(input: CreateVoteInput): Promise<CreateVoteResult>;
  deleteVote(id: string): Promise<boolean>;
  setApprovalBallot(voteId: string, optionIds: string[]): Promise<void>;
  onVotesChange(callback: (votes: Vote[]) => void): Unsubscribe;
  // ... more methods
}
```

### No UI Changes Required
Components use `useBackend()` hook - backend is abstracted away:

```typescript
import { useBackend } from '../backend';

function MyComponent() {
  const backend = useBackend();
  
  // Works with both backends!
  const votes = await backend.getVotes();
}
```

## Bundle Size Optimization

**SpacetimeDB Bundle:**
- Includes: SpacetimeDB SDK, WebSocket client, generated types
- Excludes: Apollo Client, GraphQL dependencies

**GraphQL Bundle:**
- Includes: Apollo Client, GraphQL client, subscriptions
- Excludes: SpacetimeDB SDK, generated reducers

**Result:** Smaller bundles, faster load times.

## Testing Both Backends

**SpacetimeDB:**
```bash
# Terminal 1: Server
cd server && spacetime start

# Terminal 2: Client
cd client && npm run dev:spacetime
```

**Java GraphQL:**
```bash
# Terminal 1: Server
cd java-server && mvn spring-boot:run

# Terminal 2: Client  
cd client && npm run dev:graphql
```

## Features Comparison

| Feature | SpacetimeDB | Java GraphQL |
|---------|-------------|--------------|
| Vote CRUD | ✅ | ✅ |
| Approval Voting | ✅ | ✅ |
| Real-time Updates | ✅ WebSocket | ✅ GraphQL Subscriptions |
| IP Limiting | ❌ Not available | ✅ **Working!** |
| Authentication | ⚠️ Experimental | ✅ Spring Security |

## Advantages

### Development
- Test both backends instantly
- No code changes needed
- Compare performance
- Validate feature parity

### Production
- Choose optimal backend per deployment
- Easy migration path
- Fallback options
- A/B testing capability

## Architecture

```
React Components
      ↓
useBackend() hook
      ↓
BackendProvider (auto-detects)
      ↓
   ┌──────┴───────┐
   ↓              ↓
SpacetimeBackend  GraphQLBackend
   ↓              ↓
SpacetimeDB      Apollo Client
```

## Console Messages

**Auto-detection success:**
```
🎯 Auto-detected graphql server at http://localhost:8080
```

**Configured backend:**
```
✅ Using configured spacetime backend
```

**Connection error:**
```
❌ Connection Error
No server detected
Check your server configuration
```

## Next Steps

Once you choose a backend:

1. **Development:** Use auto-detection (easiest)
2. **CI/CD:** Set `VITE_BACKEND_TYPE` environment variable
3. **Production:** Configure via build-time or runtime settings

The UI stays the same - just switch backends!
