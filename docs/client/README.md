# ZVote Client

Modern React client with **build-time backend selection**.

## Quick Start

### Recommended: Use Root Scripts

```bash
# From project root
cd ..
./go-spacetime.sh  # SpacetimeDB + auto-configured client
./go-java.sh       # Java GraphQL + auto-configured client
```

### Direct Client Commands

```bash
# SpacetimeDB
VITE_BACKEND_TYPE=spacetime VITE_STDB_PORT=3000 npm run dev:spacetime

# Java GraphQL
VITE_BACKEND_TYPE=graphql VITE_GRAPHQL_PORT=8080 npm run dev:graphql
```

## Architecture

**One codebase. Two backends. Build-time selection.**

```typescript
// Component code - same for both backends
function VotesList() {
  const backend = useBackend();
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    backend.getVotes().then(setVotes);
  }, [backend]);

  return votes.map(vote => <VoteCard {...vote} />);
}
```

No `if (backend === 'spacetime')` checks anywhere.

## Why Build-Time?

### Optimal Bundles

**SpacetimeDB build:**
- ✅ Includes: SpacetimeDB SDK, generated types
- ❌ Excludes: Apollo Client, GraphQL dependencies
- **Savings: ~100kb**

**GraphQL build:**
- ✅ Includes: Apollo Client, GraphQL client
- ❌ Excludes: SpacetimeDB SDK, generated types
- **Savings: ~50kb**

### Tree-Shaking

```typescript
// factory.ts
if (VITE_BACKEND_TYPE === 'graphql') {
  const { GraphQLBackend } = await import('./graphql');
  // SpacetimeDB code eliminated by Vite
} else {
  const { SpacetimeBackend } = await import('./spacetime');
  // GraphQL code eliminated by Vite
}
```

Vite only bundles the imported backend.

## Configuration

### Development

```bash
# Switch backends instantly
npm run dev:spacetime
npm run dev:graphql
```

### Production

```bash
# Build for SpacetimeDB
VITE_BACKEND_TYPE=spacetime npm run build

# Build for Java GraphQL
VITE_BACKEND_TYPE=graphql npm run build
```

### Environment Variables

```bash
# Dev only (Vite proxy targets)
VITE_STDB_PORT=3000          # SpacetimeDB ws port → proxied as /v1
VITE_GRAPHQL_PORT=8080       # Java HTTP port → proxied as /graphql

# Build selection
VITE_BACKEND_TYPE=spacetime | graphql
```

## Backend Interface

Both backends implement:

```typescript
interface VoteBackend {
  readonly type: 'spacetime' | 'graphql';
  readonly connected: boolean;

  getVote(id: string): Promise<Vote | null>;
  getVotes(): Promise<Vote[]>;
  createVote(input: CreateVoteInput): Promise<CreateVoteResult>;
  deleteVote(id: string): Promise<boolean>;
  
  setApprovalBallot(voteId: string, optionIds: string[]): Promise<void>;
  
  onVotesChange(callback: (votes: Vote[]) => void): Unsubscribe;
  onVoteChange(id: string, callback: (vote: Vote) => void): Unsubscribe;
}
```

## File Structure

```
src/
├── backend/
│   ├── types.ts              # Unified types
│   ├── factory.ts            # Build-time factory
│   ├── spacetime.ts          # SpacetimeDB adapter
│   ├── graphql.ts            # Apollo Client adapter
│   ├── BackendProvider.tsx   # React context
│   └── index.ts
│
├── components/
│   └── BackendStatus.tsx     # Shows active backend
│
└── hooks/
    └── useBackendVotes.ts    # Backend-agnostic hooks
```

## Testing

```bash
# Test SpacetimeDB
npm run dev:spacetime
# → Open http://localhost:5173

# Test Java GraphQL
npm run dev:graphql
# → Open http://localhost:5173

# Same UI, different backend, no code changes
```

## Benefits

✅ **Smaller bundles** - Only needed code  
✅ **Faster loads** - Less JavaScript to parse  
✅ **Tree-shaking** - Vite eliminates unused code  
✅ **Type-safe** - Same interface for both  
✅ **Zero overhead** - No runtime detection  
✅ **Easy switch** - Change env var, rebuild  

## Documentation

- `ARCHITECTURE.md` - Full design overview
- `BUILD_TIME_BACKENDS.md` - Build-time selection details
- `BACKEND_SWITCHING.md` - How to switch backends
- `USAGE_EXAMPLES.md` - Component code examples

## Summary

**One codebase. Two backends. Optimal for production.**

Choose backend at build time → Deploy optimized bundle → Users get fastest experience.
