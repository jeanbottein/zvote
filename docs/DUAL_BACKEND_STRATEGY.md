# ZVote Dual Backend Strategy

## Executive Summary

ZVote now has **two parallel server implementations**:

1. **SpacetimeDB** (Rust) - Experimental, real-time first
2. **Java Spring Boot** (Java 25) - Production-ready, full control

Both backends serve the **same React client** via an abstraction layer.

## Why Dual Backends?

### SpacetimeDB Limitations Discovered

| Feature | SpacetimeDB | Impact |
|---------|-------------|--------|
| **IP Access** | ❌ Not exposed to reducers | Can't implement IP-based ballot limiting |
| **Authentication** | ❌ Buggy, unreliable | Can't secure private votes properly |
| **Debugging** | ❌ Opaque database | Hard to troubleshoot issues |
| **Production** | ❌ Beta software | Risk for real deployments |
| **Control** | ❌ Limited | Can't customize data access |

### Java Backend Advantages

| Feature | Java Spring Boot | Benefit |
|---------|------------------|---------|
| **IP Access** | ✅ Full access via `HttpServletRequest` | Can implement ballot limiting! |
| **Authentication** | ✅ Spring Security (mature) | JWT, OAuth2, proper auth |
| **Debugging** | ✅ Standard SQL database | Use any SQL tool |
| **Production** | ✅ Battle-tested | Millions of apps in production |
| **Control** | ✅ Complete | Customize everything |
| **Real-time** | ✅ GraphQL subscriptions | Same UX as SpacetimeDB |

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      React Client (Single Codebase)     │
│          - Same UI Components           │
│          - Same Features                │
│          - Same UX                      │
└──────────────┬──────────────────────────┘
               │
               ↓
┌─────────────────────────────────────────┐
│      Backend Abstraction Layer          │
│  - VoteBackend interface                │
│  - Auto-detection or manual selection   │
│  - Unified error handling               │
└──────────┬──────────────────────────────┘
           │
    ┌──────┴──────┐
    ↓             ↓
┌─────────┐  ┌──────────┐
│SpacetimeDB│  │  Java    │
│  Rust   │  │Spring Boot│
│WebSocket│  │ GraphQL  │
└─────────┘  └──────────┘
```

## Feature Comparison

| Feature | SpacetimeDB | Java Server |
|---------|-------------|-------------|
| Vote Creation | ✅ | ✅ |
| Vote Listing | ✅ | ✅ |
| Real-time Updates | ✅ Built-in | ✅ GraphQL Subscriptions |
| Approval Voting | ✅ | 🔄 To implement |
| Majority Judgment | ✅ | 🔄 To implement |
| IP Limiting | ❌ **Blocked** | ✅ **Working** |
| Authentication | ❌ Buggy | ✅ Spring Security |
| Private Votes | ❌ RLS issues | ✅ SQL queries |
| Unlisted Votes | ✅ | ✅ |

## Technical Stack Comparison

### SpacetimeDB Stack
```
Client: TypeScript + React
  ↓ WebSocket
Server: Rust (SpacetimeDB reducers)
  ↓ Built-in
Database: SpacetimeDB (proprietary)
```

### Java Stack
```
Client: TypeScript + React + Apollo Client
  ↓ GraphQL over WebSocket
Server: Java 25 + Spring Boot 3.4 + WebFlux
  ↓ R2DBC (reactive)
Database: H2 (dev) / PostgreSQL (prod)
```

## Implementation Status

### ✅ Completed - Java Server

**Infrastructure:**
- [x] Maven project with Java 25
- [x] Spring Boot 3.4.1 + WebFlux
- [x] Netflix DGS GraphQL
- [x] R2DBC + H2 database
- [x] Feature-based packaging
- [x] ArchUnit validation
- [x] Unit tests

**Features:**
- [x] Vote Management (create, list, delete)
- [x] GraphQL queries and mutations
- [x] Real-time subscriptions
- [x] Server capabilities endpoint
- [x] Feature flags (matching SpacetimeDB)
- [x] Database schema

**Quality:**
- [x] Lombok for clean code
- [x] Records for immutability
- [x] Reactive all the way (Mono/Flux)
- [x] Architecture tests
- [x] Low cognitive complexity

### 🔄 To Implement - Java Server

- [ ] Approval voting feature
- [ ] Majority judgment feature
- [ ] IP-based ballot limiting (with working IP access!)
- [ ] Authentication (JWT)
- [ ] PostgreSQL support
- [ ] Rate limiting

### 📋 To Implement - Client Abstraction

- [ ] `VoteBackend` interface
- [ ] `SpacetimeBackend` implementation
- [ ] `GraphQLBackend` implementation  
- [ ] `BackendProvider` React context
- [ ] Update hooks to use abstraction
- [ ] Environment-based selection
- [ ] Testing with both backends

## Development Workflow

### Current (Single Backend)
```bash
# Terminal 1: SpacetimeDB
cd server && spacetime start

# Terminal 2: Client
cd client && npm run dev
```

### Future (Dual Backend)
```bash
# Option A: Use SpacetimeDB
cd server && spacetime start
cd client && VITE_BACKEND_TYPE=spacetimedb npm run dev

# Option B: Use Java Server
cd java-server && ./mvnw spring-boot:run
cd client && VITE_BACKEND_TYPE=graphql npm run dev
```

## Migration Path

### Phase 1: Parallel Development ✅ (Current)
- Java server implements vote management
- SpacetimeDB continues to work
- No client changes yet

### Phase 2: Client Abstraction (Next)
- Create backend abstraction layer
- Wrap existing SpacetimeDB client
- Implement GraphQL client
- UI works with both backends

### Phase 3: Feature Parity
- Implement voting systems in Java
- Add IP limiting (Java only)
- Add authentication
- Match all SpacetimeDB features

### Phase 4: Production Decision
- Deploy both backends
- A/B test with real users
- Collect metrics
- Choose primary backend (or keep both!)

## Use Cases for Each Backend

### Use SpacetimeDB When:
- ✅ Rapid prototyping
- ✅ Learning real-time databases
- ✅ Experimenting with new features
- ✅ Small-scale deployments

### Use Java Server When:
- ✅ Production deployments
- ✅ Need IP-based security
- ✅ Require authentication
- ✅ Want standard SQL database
- ✅ Need debugging capabilities
- ✅ Enterprise requirements

## Cost & Performance

### SpacetimeDB
- **Hosting:** SpacetimeDB Cloud (pricing TBD) or self-host
- **Scaling:** Built-in, but proprietary
- **Performance:** Very fast (in-memory)
- **Cost:** Unknown (beta pricing)

### Java Server
- **Hosting:** Any cloud (AWS, GCP, Azure, Heroku)
- **Scaling:** Horizontal (standard Spring Boot)
- **Performance:** Fast (reactive + connection pooling)
- **Cost:** Predictable (standard cloud costs)

## Testing Strategy

### Unit Tests
- **Java:** JUnit Jupiter + Mockito
- **SpacetimeDB:** Rust unit tests (if needed)
- **Client:** Vitest (works with both backends)

### Integration Tests
- **Java:** Spring Boot Test + TestContainers
- **SpacetimeDB:** End-to-end via client
- **Both:** Same client test suite

### Architecture Tests
- **Java:** ArchUnit validates structure
- **Client:** ESLint rules

## Deployment Options

### Option 1: Java Only (Recommended for Production)
```
React Client → Java Spring Boot → PostgreSQL
```

### Option 2: SpacetimeDB Only (Experimental)
```
React Client → SpacetimeDB
```

### Option 3: Dual Deployment (Maximum Flexibility)
```
               ┌→ Java Server (main traffic)
React Client ──┤
               └→ SpacetimeDB (experimental features)
```

## Decision Criteria

Choose **Java Server** if you need:
- ✅ IP-based ballot limiting
- ✅ Production reliability
- ✅ Standard database
- ✅ Enterprise auth
- ✅ Debugging tools

Choose **SpacetimeDB** if you want:
- ✅ Faster development
- ✅ Experiment with new tech
- ✅ Built-in real-time
- ✅ Simpler deployment (initially)

## Next Immediate Steps

1. **Test Java Server**
   ```bash
   cd java-server
   ./mvnw spring-boot:run
   # Open http://localhost:8080/graphiql
   ```

2. **Create Client Abstraction**
   - Define `VoteBackend` interface
   - Implement both backends
   - Update hooks

3. **Feature Parity**
   - Implement voting systems in Java
   - Add IP limiting
   - Add authentication

4. **Production Pilot**
   - Deploy Java server
   - Test with real users
   - Gather feedback

## Documentation

- **Java Server:** `java-server/README.md`
- **Client Abstraction:** `CLIENT_ABSTRACTION_STRATEGY.md`
- **SpacetimeDB Limits:** `server/IP_LIMITING_STATUS.md`

---

## Summary

**We now have two paths forward:**

1. **SpacetimeDB Path:** Experimental, limited by platform constraints
2. **Java Path:** Production-ready, full control, all features possible

**The client will support both**, giving us maximum flexibility.

**Recommendation:** Focus on Java server for production, keep SpacetimeDB for experimentation.

---

**Status:** 🚀 Ready for development

Both backends are set up and ready. Next step is client abstraction layer.
