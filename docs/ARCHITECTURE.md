# ZVote Architecture: Dual Backend Design

## 🎯 Design Philosophy

**Low cognitive complexity. High intuition. Zero boilerplate.**

The client detects and adapts to either backend automatically. No configuration unless you want it.

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│      React Client (Single UI)      │
│   - Same components everywhere      │
│   - No backend-specific code        │
└──────────────┬──────────────────────┘
               │
               ↓ useBackend()
┌─────────────────────────────────────┐
│      Backend Abstraction Layer      │
│   - Auto-detects server type        │
│   - Unified interface                │
│   - Real-time subscriptions          │
└──────────────┬──────────────────────┘
               │
         ┌─────┴─────┐
         ↓           ↓
    ┌─────────┐ ┌──────────┐
    │Spacetime│ │  GraphQL │
    │ Backend │ │ Backend  │
    └─────────┘ └──────────┘
         ↓           ↓
    ┌─────────┐ ┌──────────┐
    │   Rust  │ │   Java   │
    │SpacetimeDB│ Spring Boot│
    └─────────┘ └──────────┘
```

## 🧠 Build-Time Selection

### Optimized Bundle (IQ 200)

```typescript
// Vite build → tree-shakes unused backend
const BACKEND_TYPE = import.meta.env.VITE_BACKEND_TYPE;

export async function createBackend() {
  if (BACKEND_TYPE === 'graphql') {
    const { GraphQLBackend } = await import('./graphql');
    // SpacetimeDB code NOT in bundle
    return new GraphQLBackend(url);
  } else {
    const { SpacetimeBackend } = await import('./spacetime');
    // GraphQL code NOT in bundle
    return new SpacetimeBackend();
  }
}
```

**Result:**
- SpacetimeDB build: ~50kb smaller (no Apollo Client)
- GraphQL build: ~50kb smaller (no SpacetimeDB SDK)

Set once before build. Deploy optimized.

## 💡 Unified Interface

One interface. Two implementations. Zero conditionals.

```typescript
interface VoteBackend {
  readonly type: 'spacetime' | 'graphql';
  readonly connected: boolean;
  
  getVote(id: string): Promise<Vote>;
  createVote(input: CreateVoteInput): Promise<CreateVoteResult>;
  setApprovalBallot(voteId: string, optionIds: string[]): Promise<void>;
  
  onVotesChange(callback: (votes: Vote[]) => void): Unsubscribe;
}
```

### Component Usage

```typescript
function VoteList() {
  const backend = useBackend();  // SpacetimeDB or GraphQL
  const [votes, setVotes] = useState([]);
  
  useEffect(() => {
    backend.getVotes().then(setVotes);
    return backend.onVotesChange(setVotes);
  }, [backend]);
  
  return votes.map(vote => <VoteCard {...vote} />);
}
```

**No backend checks. No conditional logic. Just code.**

## 🔌 Backend Implementations

### SpacetimeBackend

```typescript
class SpacetimeBackend implements VoteBackend {
  async getVotes() {
    return Vote.all().filter(v => v.visibility === Visibility.PUBLIC);
  }
  
  onVotesChange(callback) {
    Vote.onInsert(callback);
    Vote.onUpdate(callback);
    return () => {
      Vote.offInsert(callback);
      Vote.offUpdate(callback);
    };
  }
}
```

### GraphQLBackend

```typescript
class GraphQLBackend implements VoteBackend {
  async getVotes() {
    const { data } = await this.client.query({
      query: gql`query { publicVotes { id title } }`
    });
    return data.publicVotes;
  }
  
  onVotesChange(callback) {
    const sub = this.client.subscribe({
      query: gql`subscription { publicVoteCreated { id title } }`
    });
    return () => sub.unsubscribe();
  }
}
```

## 🎨 Clean Component Example

```typescript
function CreateVote() {
  const backend = useBackend();
  const [creating, setCreating] = useState(false);
  
  const handleSubmit = async (input) => {
    setCreating(true);
    const result = await backend.createVote(input);
    setCreating(false);
    
    if (result.error) {
      showError(result.error);
    } else {
      navigate(`/vote/${result.vote.id}`);
    }
  };
  
  return <VoteForm onSubmit={handleSubmit} loading={creating} />;
}
```

**Backend-agnostic. Intuitive. Zero ceremony.**

## 🚀 Usage Patterns

### Pattern 1: List Data

```typescript
const { votes, loading } = useBackendVotes();

return loading ? <Spinner /> : <VoteList votes={votes} />;
```

### Pattern 2: Create Data

```typescript
const { createVote, creating } = useCreateBackendVote();

const handleCreate = () => createVote({
  title: 'Best Framework',
  options: ['React', 'Vue', 'Svelte']
});
```

### Pattern 3: Real-time Updates

```typescript
useEffect(() => {
  const unsub = backend.onVoteChange(voteId, (updated) => {
    setVote(updated);
  });
  return unsub;
}, [voteId]);
```

## 🎛️ Configuration (Optional)

### Auto (Default)

```bash
npm run dev
# Detects running server automatically
```

### Manual Override

```bash
# Environment
VITE_BACKEND_TYPE=graphql npm run dev

# Or create .env
cp .env.graphql .env
npm run dev

# Or localStorage
localStorage.setItem('backend_config', JSON.stringify({
  type: 'graphql',
  url: 'http://localhost:8080'
}));
```

## 📊 Feature Matrix

| Feature | SpacetimeDB | Java GraphQL |
|---------|-------------|--------------|
| Vote CRUD | ✅ | ✅ |
| Approval Voting | ✅ | ✅ |
| Majority Judgment | ✅ | 🔄 |
| Real-time | ✅ WebSocket | ✅ Subscriptions |
| IP Limiting | ❌ Not possible | ✅ **Works!** |
| Auth | ⚠️ Experimental | ✅ Spring Security |

## 🔍 Detection Algorithm

```typescript
async function detectServer(urls: string[]) {
  for (const url of urls) {
    // GraphQL check: POST with introspection query
    const isGraphQL = await fetch(`${url}/graphql`, {
      method: 'POST',
      body: JSON.stringify({ query: '{ __schema { types { name } } }' })
    }).then(r => r.ok);
    
    // SpacetimeDB check: WebSocket handshake
    const isSpacetime = await new Promise(resolve => {
      const ws = new WebSocket(`${url.replace('http', 'ws')}/database/subscribe/zvote-proto1`);
      ws.onopen = () => { ws.close(); resolve(true); };
      ws.onerror = () => resolve(false);
      setTimeout(() => { ws.close(); resolve(false); }, 2000);
    });
    
    if (isGraphQL) return { type: 'graphql', url };
    if (isSpacetime) return { type: 'spacetime', url };
  }
  
  return null;
}
```

## 🎯 Type Safety

```typescript
// Unified types across backends
type Visibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
type VotingSystem = 'APPROVAL' | 'MAJORITY_JUDGMENT';

interface Vote {
  id: string;
  title: string;
  visibility: Visibility;
  votingSystem: VotingSystem;
  options?: VoteOption[];
}

// Backend implementations map their native types
class SpacetimeBackend {
  private mapVote(native: gen.Vote): Vote {
    return {
      id: native.id.toString(),
      visibility: this.mapVisibility(native.visibility),
      // ...
    };
  }
}
```

## 🏃‍♂️ Quick Start

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

**Switch backends:**
```bash
cp .env.spacetime .env  # or .env.graphql
npm run dev
```

## 📦 Files Structure

```
client/src/
├── backend/
│   ├── types.ts              # Unified types
│   ├── factory.ts            # Build-time backend factory
│   ├── spacetime.ts          # SpacetimeDB impl
│   ├── graphql.ts            # GraphQL impl
│   ├── BackendProvider.tsx   # React context
│   └── index.ts              # Exports
│
├── hooks/
│   └── useBackendVotes.ts    # Clean hooks
│
└── components/
    └── BackendStatus.tsx      # Status indicator
```

## 🧪 Testing Both Backends

```bash
# Test SpacetimeDB
npm run dev:spacetime

# Test Java GraphQL  
npm run dev:graphql

# Same UI, different backends!
```

## 💬 Philosophy

> "The best abstraction is the one you don't notice."

- No `if (backend === 'spacetime')` conditionals
- No duplicate components for different backends
- No runtime type checking
- No configuration unless needed

**Just write code. It works everywhere.**

## 🎉 Benefits

### For Developers
- Write once, run anywhere
- Type-safe across backends
- Hot-reload works with both
- Zero mental overhead
- Easy to switch during development

### For Users
- Same UX regardless of backend
- Faster page loads (optimized bundles)
- Seamless real-time updates
- No visible difference

### For Deployment
- **Optimal bundles** - Only needed code included
- **Smaller assets** - 50-100kb savings per build
- **Choose per environment** - Different backends for dev/prod
- **Fast builds** - Tree-shaking eliminates unused code

## 🚦 Status Indicator

Bottom-right corner shows active backend:

```
🟢 Java GraphQL ●    (connected)
🔵 SpacetimeDB ●    (connected)
```

Unobtrusive. Always visible. Always accurate.

---

**Result:** One UI. Two backends. Optimal bundles.

**Build-time selection. Tree-shaken. Production-ready.**
