# Build-Time Backend Selection

## Philosophy

**One backend per build.** No runtime detection. Optimal bundle size.

## Why Build-Time?

1. **Smaller bundles** - Only includes code for chosen backend
2. **Tree-shaking** - Vite eliminates unused backend code
3. **Zero overhead** - No runtime checks, no detection logic
4. **Production-ready** - Decide once, deploy optimized

## How It Works

### Configuration (dev)

```bash
# Choose backend at launch (no .env files in dev)
# SpacetimeDB
VITE_BACKEND_TYPE=spacetime VITE_STDB_PORT=3000 npm run dev:spacetime

# Java GraphQL
VITE_BACKEND_TYPE=graphql VITE_GRAPHQL_PORT=8080 npm run dev:graphql
```

### Factory Pattern

```typescript
// factory.ts - Dynamic imports for tree-shaking
const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE;

export async function createBackend(): Promise<VoteBackend> {
  if (BACKEND_TYPE === 'graphql') {
    const { GraphQLBackend } = await import('./graphql');
    // Same-origin GraphQL: Vite proxies /graphql → backend port in dev
    return new GraphQLBackend();
  }
  const { SpacetimeBackend } = await import('./spacetime');
  return new SpacetimeBackend();
}
```

**Result:** Vite only bundles the imported module.

### Provider

```typescript
// BackendProvider.tsx - One backend per app
export function BackendProvider({ children }) {
  const [backend, setBackend] = useState(null);

  useEffect(() => {
    createBackend().then(setBackend);
  }, []);

  return <Context.Provider value={backend}>{children}</Context.Provider>;
}
```

## Bundle Analysis

### SpacetimeDB Build

```
Included:
- spacetimedb SDK (~50kb)
- Generated types
- WebSocket client

Excluded:
- Apollo Client (~100kb)
- GraphQL dependencies
- Unused code

Total savings: ~100kb+
```

### GraphQL Build

```
Included:
- Apollo Client (~100kb)
- GraphQL subscriptions
- WebSocket transport

Excluded:
- SpacetimeDB SDK (~50kb)
- Generated reducers
- Unused code

Total savings: ~50kb+
```

## Development Workflow

### Quick Switch

```bash
# Use SpacetimeDB
npm run dev:spacetime

# Use Java GraphQL
npm run dev:graphql
```

### Production Build

Set `VITE_BACKEND_TYPE` in your build environment and ensure your reverse proxy routes same-origin endpoints:

```bash
# SpacetimeDB build
VITE_BACKEND_TYPE=spacetime npm run build
# Route /v1 → spacetime server

# Java GraphQL build
VITE_BACKEND_TYPE=graphql npm run build
# Route /graphql → java server
```

## Code Impact

### Component Code (Same)

```typescript
function VotesList() {
  const backend = useBackend();
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    backend.getVotes().then(setVotes);
  }, [backend]);

  return votes.map(vote => <VoteCard {...vote} />);
}
```

**No changes needed.** Backend is abstracted.

### Type Safety (Same)

```typescript
interface VoteBackend {
  getVotes(): Promise<Vote[]>;
  createVote(input: CreateVoteInput): Promise<CreateVoteResult>;
  setApprovalBallot(voteId: string, optionIds: string[]): Promise<void>;
}
```

**Both backends implement same interface.**

## Deployment

### SpacetimeDB Deployment

```dockerfile
# Dockerfile
ENV VITE_BACKEND_TYPE=spacetime
RUN npm run build
```

### Java GraphQL Deployment

```dockerfile
# Dockerfile
ENV VITE_BACKEND_TYPE=graphql
RUN npm run build
```

## CI/CD

```yaml
# .github/workflows/deploy.yml
- name: Build for SpacetimeDB
  run: |
    cp .env.spacetime .env
    npm run build
    
- name: Build for Java GraphQL
  run: |
    cp .env.graphql .env
    npm run build
```

## Comparison

| Aspect | Runtime Detection | Build-Time Selection |
|--------|------------------|---------------------|
| Bundle Size | Both backends included | Only chosen backend |
| First Load | Slower (both backends) | Faster (one backend) |
| Flexibility | Switch at runtime | Switch at build |
| Optimization | Limited | Full tree-shaking |
| Production | One build, many deploys | Build per backend |

## Benefits

✅ **Optimal bundles** - No unused code  
✅ **Faster loads** - Smaller JavaScript payload  
✅ **Simpler** - No detection logic  
✅ **Type-safe** - Same interface  
✅ **Flexible** - Easy to switch during dev  

## Summary

**Build once per backend. Deploy optimized. Zero runtime overhead.**

Perfect for production deployments where you know which backend you're using.
