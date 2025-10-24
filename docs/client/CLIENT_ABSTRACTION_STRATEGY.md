# Client Abstraction Layer Strategy

## Goal

Enable the React client to work with **both** SpacetimeDB and Java backends seamlessly, using the same UI components.

## Architecture

```
UI Components (unchanged)
     ↓
Backend Abstraction Layer (new)
     ↓
  ┌─────┴──────┐
  ↓            ↓
SpacetimeDB   Java GraphQL
  Client      Client
```

## Implementation Plan

### 1. Backend Interface

Create a unified interface that both backends implement:

```typescript
// client/src/backend/BackendInterface.ts
export interface VoteBackend {
  // Server info
  getServerInfo(): Promise<ServerInfo>;
  
  // Vote queries
  getVote(id: string): Promise<Vote | null>;
  getPublicVotes(): Promise<Vote[]>;
  getMyVotes(): Promise<Vote[]>;
  
  // Vote mutations
  createVote(input: CreateVoteInput): Promise<CreateVoteResult>;
  deleteVote(id: string): Promise<boolean>;
  
  // Real-time subscriptions
  subscribeToVote(id: string, callback: (vote: Vote) => void): Unsubscribe;
  subscribeToPublicVotes(callback: (vote: Vote) => void): Unsubscribe;
  
  // Ballot operations (to be implemented)
  submitApprovalBallot(voteId: string, optionIds: string[]): Promise<void>;
  submitJudgmentBallot(optionId: string, mention: Mention): Promise<void>;
}

export type CreateVoteInput = {
  title: string;
  options: string[];
  visibility: Visibility;
  votingSystem: VotingSystem;
  limitByIp: boolean;
};

export type Unsubscribe = () => void;
```

### 2. SpacetimeDB Implementation

```typescript
// client/src/backend/spacetimedb/SpacetimeBackend.ts
export class SpacetimeBackend implements VoteBackend {
  private client: SpacetimeDBClient;
  
  constructor(url: string) {
    this.client = new SpacetimeDBClient(url);
  }
  
  async getServerInfo(): Promise<ServerInfo> {
    // Use existing SpacetimeDB table query
    const serverInfo = this.client.db.server_info.id().find(1);
    return mapToServerInfo(serverInfo);
  }
  
  subscribeToVote(id: string, callback: (vote: Vote) => void): Unsubscribe {
    // Use SpacetimeDB's built-in subscriptions
    const subscription = this.client.db.vote
      .by_public_id()
      .filter(id)
      .onInsert(callback)
      .onUpdate(callback);
    
    return () => subscription.unsubscribe();
  }
  
  // ... other methods
}
```

### 3. Java GraphQL Implementation

```typescript
// client/src/backend/graphql/GraphQLBackend.ts
import { ApolloClient, gql } from '@apollo/client';

export class GraphQLBackend implements VoteBackend {
  private client: ApolloClient;
  
  constructor(url: string) {
    this.client = new ApolloClient({
      uri: `${url}/graphql`,
      cache: new InMemoryCache()
    });
  }
  
  async getServerInfo(): Promise<ServerInfo> {
    const { data } = await this.client.query({
      query: gql`
        query {
          serverInfo {
            maxOptions
            features {
              ipLimiting
              approvalVoting
              majorityJudgment
            }
          }
        }
      `
    });
    return data.serverInfo;
  }
  
  subscribeToVote(id: string, callback: (vote: Vote) => void): Unsubscribe {
    // Use GraphQL subscription
    const subscription = this.client.subscribe({
      query: gql`
        subscription {
          voteUpdated(id: "${id}") {
            id
            title
            options {
              label
              approvalsCount
            }
          }
        }
      `
    }).subscribe({
      next: ({ data }) => callback(data.voteUpdated)
    });
    
    return () => subscription.unsubscribe();
  }
  
  // ... other methods
}
```

### 4. Backend Factory

```typescript
// client/src/backend/BackendFactory.ts
export enum BackendType {
  SPACETIMEDB = 'spacetimedb',
  GRAPHQL = 'graphql'
}

export class BackendFactory {
  static create(type: BackendType, config: BackendConfig): VoteBackend {
    switch (type) {
      case BackendType.SPACETIMEDB:
        return new SpacetimeBackend(config.spacetimeUrl);
      case BackendType.GRAPHQL:
        return new GraphQLBackend(config.graphqlUrl);
      default:
        throw new Error(`Unknown backend type: ${type}`);
    }
  }
  
  static detectBackend(): BackendType {
    // Auto-detect from environment or config
    const envBackend = import.meta.env.VITE_BACKEND_TYPE;
    return envBackend === 'graphql' 
      ? BackendType.GRAPHQL 
      : BackendType.SPACETIMEDB;
  }
}
```

### 5. React Context Provider

```typescript
// client/src/backend/BackendProvider.tsx
import { createContext, useContext, ReactNode } from 'react';

const BackendContext = createContext<VoteBackend | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const backendType = BackendFactory.detectBackend();
  const backend = BackendFactory.create(backendType, {
    spacetimeUrl: import.meta.env.VITE_SPACETIMEDB_URL,
    graphqlUrl: import.meta.env.VITE_GRAPHQL_URL
  });
  
  return (
    <BackendContext.Provider value={backend}>
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend(): VoteBackend {
  const backend = useContext(BackendContext);
  if (!backend) throw new Error('useBackend must be used within BackendProvider');
  return backend;
}
```

### 6. Update Hooks to Use Abstraction

```typescript
// client/src/hooks/useCreateVote.ts
import { useBackend } from '../backend/BackendProvider';

export const useCreateVote = () => {
  const backend = useBackend();
  const [isCreating, setIsCreating] = useState(false);
  
  const createVote = async (input: CreateVoteInput) => {
    setIsCreating(true);
    try {
      const result = await backend.createVote(input);
      return result;
    } finally {
      setIsCreating(false);
    }
  };
  
  return { createVote, isCreating };
};
```

### 7. Environment Configuration

```bash
# .env.spacetimedb
VITE_BACKEND_TYPE=spacetimedb
VITE_SPACETIMEDB_URL=ws://localhost:3000

# .env.graphql
VITE_BACKEND_TYPE=graphql
VITE_GRAPHQL_URL=http://localhost:8080
```

## Migration Strategy

### Phase 1: Create Abstraction Layer ✅
- Define `VoteBackend` interface
- Implement `SpacetimeBackend` (wraps existing code)
- Implement `GraphQLBackend` (new)
- Create `BackendProvider` context

### Phase 2: Update Hooks
- Migrate `useVotes` to use `useBackend()`
- Migrate `useCreateVote` to use `useBackend()`
- Migrate `useVoteActions` to use `useBackend()`
- Keep UI components unchanged

### Phase 3: Testing
- Test with SpacetimeDB backend (should work exactly as before)
- Test with Java GraphQL backend
- Ensure real-time updates work with both

### Phase 4: Feature Flags Integration
- Read `ServerInfo` from backend
- Enable/disable UI features based on backend capabilities
- Handle differences gracefully (e.g., IP limiting only on Java)

## Benefits

### For Development
- ✅ Test both backends in parallel
- ✅ Compare performance and features
- ✅ Easy to switch backends (just change env var)
- ✅ Gradual migration (no big bang rewrite)

### For Production
- ✅ Choose best backend for use case
- ✅ Or run both (different deployments)
- ✅ Easy to migrate users between backends
- ✅ Fallback option if one backend has issues

## Challenges & Solutions

### Challenge 1: Type Differences
**Problem:** SpacetimeDB types vs GraphQL types
**Solution:** Map to common types in abstraction layer

### Challenge 2: Real-time Mechanisms
**Problem:** SpacetimeDB subscriptions vs GraphQL subscriptions
**Solution:** Abstract behind `subscribe()` interface, both return `Unsubscribe`

### Challenge 3: Error Handling
**Problem:** Different error formats
**Solution:** Normalize errors to common format

### Challenge 4: Feature Parity
**Problem:** Backends may have different features
**Solution:** Use `ServerInfo.features` to enable/disable UI

## File Structure

```
client/src/
├── backend/
│   ├── BackendInterface.ts      # Interface definition
│   ├── BackendFactory.ts        # Factory + detection
│   ├── BackendProvider.tsx      # React context
│   ├── spacetimedb/
│   │   └── SpacetimeBackend.ts  # SpacetimeDB impl
│   └── graphql/
│       ├── GraphQLBackend.ts    # GraphQL impl
│       ├── queries.ts           # GraphQL queries
│       └── subscriptions.ts     # GraphQL subscriptions
│
├── hooks/                       # Updated to use useBackend()
│   ├── useVotes.ts
│   ├── useCreateVote.ts
│   └── useVoteActions.ts
│
└── components/                  # Unchanged!
    ├── CreateVoteForm.tsx
    ├── VoteList.tsx
    └── ...
```

## Next Steps

1. ✅ Define `VoteBackend` interface
2. ⏳ Implement `SpacetimeBackend` (wrap existing)
3. ⏳ Implement `GraphQLBackend` with Apollo Client
4. ⏳ Create `BackendProvider` context
5. ⏳ Update hooks to use abstraction
6. ⏳ Test with both backends
7. ⏳ Document usage and deployment

---

**Status:** 📋 Planned - Ready to implement

This abstraction will give us flexibility to use the best backend for each use case while keeping the UI completely unchanged.
