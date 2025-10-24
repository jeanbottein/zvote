# Backend Abstraction - Usage Examples

## Zero Configuration (IQ 200)

**Just start the client:**
```bash
npm run dev
```

Console output:
```
🎯 Auto-detected graphql server at http://localhost:8080
```

**That's it.** No config files. No environment variables. Pure magic.

## Component Usage (Intuitive)

### Example 1: List Votes

```typescript
function VotesList() {
  const backend = useBackend();
  const [votes, setVotes] = useState<Vote[]>([]);

  useEffect(() => {
    backend.getVotes().then(setVotes);
    const unsub = backend.onVotesChange(setVotes);
    return unsub;
  }, [backend]);

  return (
    <div>
      {votes.map(vote => (
        <div key={vote.id}>{vote.title}</div>
      ))}
    </div>
  );
}
```

**No backend checks. No conditionals. Just code.**

### Example 2: Create Vote

```typescript
function CreateVoteButton() {
  const backend = useBackend();

  const handleClick = async () => {
    const result = await backend.createVote({
      title: 'Best Framework',
      options: ['React', 'Vue', 'Svelte'],
      visibility: 'PUBLIC',
      votingSystem: 'APPROVAL'
    });

    if (result.error) {
      alert(result.error);
    }
  };

  return <button onClick={handleClick}>Create Vote</button>;
}
```

**Same code works with both backends. Zero changes.**

### Example 3: Real-time Updates

```typescript
function VoteDetail({ voteId }: { voteId: string }) {
  const backend = useBackend();
  const [vote, setVote] = useState<Vote | null>(null);

  useEffect(() => {
    backend.getVote(voteId).then(setVote);
    
    const unsub = backend.onVoteChange(voteId, (updated) => {
      setVote(updated);
    });
    
    return unsub;
  }, [voteId, backend]);

  if (!vote) return <Spinner />;

  return (
    <div>
      <h2>{vote.title}</h2>
      <p>System: {vote.votingSystem}</p>
    </div>
  );
}
```

**Real-time subscriptions work identically on both backends.**

### Example 4: Submit Ballot

```typescript
function ApprovalBallot({ voteId, options }: Props) {
  const backend = useBackend();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleSubmit = async () => {
    await backend.setApprovalBallot(voteId, Array.from(selected));
  };

  const handleToggle = (optionId: string) => {
    const next = new Set(selected);
    if (next.has(optionId)) {
      next.delete(optionId);
    } else {
      next.add(optionId);
    }
    setSelected(next);
  };

  return (
    <div>
      {options.map(option => (
        <button
          key={option.id}
          onClick={() => handleToggle(option.id)}
          className={selected.has(option.id) ? 'selected' : ''}
        >
          {option.label}
        </button>
      ))}
      <button onClick={handleSubmit}>Submit Ballot</button>
    </div>
  );
}
```

**Voting logic is backend-agnostic. Clean and simple.**

## Hook Usage (Clean)

### useBackendVotes Hook

```typescript
export function useBackendVotes() {
  const backend = useBackend();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    backend.getVotes()
      .then(v => mounted && setVotes(v))
      .finally(() => mounted && setLoading(false));

    const unsubscribe = backend.onVotesChange(v => {
      if (mounted) setVotes(v);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [backend]);

  return { votes, loading, backend };
}
```

Usage:
```typescript
function HomePage() {
  const { votes, loading } = useBackendVotes();

  if (loading) return <Spinner />;

  return <VotesList votes={votes} />;
}
```

**One hook. Works everywhere.**

## Backend Info (Minimal)

### Show Backend Status

```typescript
function BackendIndicator() {
  const { type, connected } = useBackendInfo();

  return (
    <div>
      Backend: {type} {connected ? '✅' : '❌'}
    </div>
  );
}
```

### Backend-Specific Features

```typescript
function FeatureGate({ children }: { children: ReactNode }) {
  const { type } = useBackendInfo();
  const backend = useBackend();
  const [info, setInfo] = useState<ServerInfo | null>(null);

  useEffect(() => {
    backend.getServerInfo().then(setInfo);
  }, [backend]);

  if (!info?.features.ipLimiting) {
    return <div>IP limiting not available on {type}</div>;
  }

  return <>{children}</>;
}
```

**Feature detection, not backend detection.**

## Testing Both Backends

### Test Script

```bash
#!/bin/bash

echo "Testing SpacetimeDB..."
spacetime start &
SPACETIME_PID=$!
sleep 2

npm run dev &
CLIENT_PID=$!
sleep 5

echo "Press enter to test Java backend..."
read

kill $SPACETIME_PID $CLIENT_PID

echo "Testing Java GraphQL..."
cd ../java-server
mvn spring-boot:run &
JAVA_PID=$!
cd ../client
sleep 5

npm run dev &
CLIENT_PID=$!

echo "Press enter to stop..."
read

kill $JAVA_PID $CLIENT_PID
```

**Same client. Different backends. No changes.**

## Advanced: Manual Configuration

### Override Detection

```typescript
localStorage.setItem('backend_config', JSON.stringify({
  type: 'graphql',
  url: 'http://my-server.com:8080',
  autoDetect: false
}));

// Refresh page
location.reload();
```

### Environment Variables

```bash
# .env.production
VITE_BACKEND_TYPE=graphql
VITE_BACKEND_URL=https://api.zvote.com
```

### Runtime Detection Log

```typescript
// detector.ts automatically logs:
console.log('🎯 Auto-detected graphql server at http://localhost:8080');

// Or if detection fails:
console.error('❌ No server detected at candidate URLs');
```

## Philosophy

> **"The best API is the one you don't notice."**

- No `if (backend === 'spacetime')` anywhere
- No backend-specific components
- No conditional imports
- No configuration boilerplate
- No mental overhead

**Just write code. It works.**

## Cognitive Complexity: Zero

```typescript
// This is ALL you need to know:
const backend = useBackend();

// Everything else is TypeScript autocomplete:
backend.getVote()
backend.createVote()
backend.setApprovalBallot()
backend.onVotesChange()
```

**IQ 200 simplicity. Zero obvious comments needed.**

## Summary

| Aspect | Complexity |
|--------|-----------|
| Configuration | 0️⃣ (auto-detect) |
| Component Code | 0️⃣ (same everywhere) |
| Backend Checks | 0️⃣ (abstracted away) |
| Mental Model | 0️⃣ (just use backend) |
| Learning Curve | 0️⃣ (obvious from types) |

**Result:** Pure, clean, intuitive code that works with any backend.

No ceremony. No boilerplate. Just elegant abstraction.
