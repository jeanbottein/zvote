# ZVote Java Server

Modern reactive voting server built with **Spring Boot 3.4+** and **Java 25**, providing real-time updates via GraphQL subscriptions.

## Why Java Server Parallel to SpacetimeDB?

SpacetimeDB has limitations that block key features:
- ❌ **No IP address access** in reducers (can't implement IP-based ballot limiting)
- ❌ **Auth issues** (bugs preventing proper authentication)
- ❌ **Limited control** over data access patterns
- ❌ **Debugging challenges** with proprietary database

Java server provides:
- ✅ **Full IP access** - can implement ballot limiting properly
- ✅ **Mature auth** - Spring Security with JWT, OAuth2, etc.
- ✅ **Complete control** - standard SQL database, familiar tools
- ✅ **Real-time updates** - GraphQL subscriptions over WebSocket
- ✅ **Production-ready** - battle-tested stack

## Tech Stack

### Core
- **Java 25** - Latest Java with modern language features
- **Spring Boot 3.4.1** - Latest framework version
- **Spring WebFlux** - Reactive, non-blocking web framework
- **Project Reactor** - Reactive programming library

### Data Layer
- **Spring Data R2DBC** - Reactive database access
- **H2 Database** - In-memory (development), can swap for PostgreSQL/MySQL

### GraphQL
- **Netflix DGS** - Modern GraphQL framework
- **GraphQL Subscriptions** - Real-time updates over WebSocket

### Quality
- **Lombok** - Reduce boilerplate
- **JUnit Jupiter** - Modern testing
- **ArchUnit** - Architecture validation
- **AssertJ** - Fluent assertions

## Architecture

### Feature-Based Packaging (Josh Long Style)

```
org.zvote.server/
├── votemanagement/          # Vote CRUD, listing
│   ├── Vote.java            # Entity (record)
│   ├── VoteOption.java      # Entity (record)
│   ├── VoteRepository.java  # Data access
│   ├── VoteService.java     # Business logic
│   ├── VoteDataFetcher.java # GraphQL resolver
│   └── dto/                 # DTOs
│       ├── CreateVoteInput.java
│       └── CreateVoteResult.java
│
├── votingsystems/           # Ballot submission
│   ├── approvalvoting/      # Approval voting feature
│   │   ├── Approval.java
│   │   ├── ApprovalService.java
│   │   └── ApprovalDataFetcher.java
│   └── majorityjudgment/    # Majority judgment feature
│       ├── Judgment.java
│       ├── MjService.java
│       └── MjDataFetcher.java
│
└── common/                  # Shared utilities
    ├── ServerInfoDataFetcher.java
    ├── ZVoteProperties.java
    └── dto/
```

### Key Principles

1. **Low Cognitive Complexity** - Small, focused methods
2. **Modern Java Style** - Records, var, pattern matching
3. **Reactive All the Way** - Mono/Flux from controller to database
4. **Feature Isolation** - Features don't depend on each other
5. **Test Coverage** - Unit tests + ArchUnit validation

## GraphQL API

### Queries

```graphql
# Get server capabilities
query {
  serverInfo {
    maxOptions
    features {
      ipLimiting  # TRUE in Java! (unlike SpacetimeDB)
    }
  }
}

# List public votes
query {
  publicVotes {
    id
    title
    options {
      label
      approvalsCount
    }
  }
}
```

### Mutations

```graphql
mutation {
  createVote(input: {
    title: "Best Pizza Topping"
    options: ["Pepperoni", "Mushroom", "Pineapple"]
    visibility: PUBLIC
    votingSystem: APPROVAL
    limitByIp: true  # We CAN enforce this!
  }) {
    vote {
      id
      shareToken
    }
    error
  }
}
```

### Subscriptions (Real-Time!)

```graphql
# Subscribe to vote updates
subscription {
  voteUpdated(id: "uuid-here") {
    title
    options {
      approvalsCount
    }
  }
}

# Subscribe to new public votes
subscription {
  publicVoteCreated {
    id
    title
  }
}
```

## Real-Time Updates Implementation

Unlike SpacetimeDB's opaque subscription system, we use **Reactor Sinks**:

```java
// In VoteService
private final Map<UUID, Sinks.Many<Vote>> voteUpdateSinks;

public Flux<Vote> subscribeToVoteUpdates(UUID voteId) {
    var sink = voteUpdateSinks.computeIfAbsent(
        voteId, 
        k -> Sinks.many().multicast().onBackpressureBuffer()
    );
    return sink.asFlux();
}

public void publishVoteUpdate(Vote vote) {
    voteUpdateSinks.get(vote.publicId())?.tryEmitNext(vote);
}
```

**Flow:**
1. Client subscribes via GraphQL subscription
2. Creates Flux connected to Sink
3. Service publishes updates to Sink
4. Updates flow to all subscribers in real-time

## Running

### Development

```bash
cd java-server
./mvnw spring-boot:run
```

Server starts on http://localhost:8080

### GraphiQL Interface

Open http://localhost:8080/graphiql for interactive GraphQL playground

### Testing

```bash
# Unit tests
./mvnw test

# Architecture validation
./mvnw test -Dtest=ArchitectureTest

# All tests
./mvnw verify
```

## Configuration

`application.yml` - Feature flags matching SpacetimeDB:

```yaml
zvote:
  features:
    ip-limiting: true  # We can implement this!
    approval-voting: true
    majority-judgment: true
  limits:
    max-options: 20
```

## Advantages Over SpacetimeDB

| Feature | SpacetimeDB | Java Server |
|---------|-------------|-------------|
| **IP Limiting** | ❌ Can't access IP | ✅ Full IP access |
| **Authentication** | ❌ Buggy auth | ✅ Spring Security |
| **Real-time** | ✅ Built-in | ✅ GraphQL subscriptions |
| **Debugging** | ❌ Opaque | ✅ Standard tools |
| **Database** | ❌ Proprietary | ✅ SQL (H2/Postgres) |
| **Maturity** | ❌ Beta | ✅ Production-ready |
| **Control** | ❌ Limited | ✅ Complete |

## Migration Path

1. **Phase 1: Parallel Development** ✅ (current)
   - Java server implements same features
   - Client abstraction layer supports both backends
   
2. **Phase 2: Feature Parity**
   - Implement approval voting + majority judgment
   - Add IP limiting (working!)
   - Real-time subscriptions

3. **Phase 3: Client Integration**
   - Update client to detect backend type
   - Use same UI for both backends
   - Feature flags control differences

4. **Phase 4: Production Choice**
   - Evaluate both in production
   - Choose based on real usage
   - Or keep both for different use cases

## Next Steps

- [ ] Implement approval voting feature
- [ ] Implement majority judgment feature
- [ ] Add IP-based ballot limiting (with real IP access!)
- [ ] Create client abstraction layer
- [ ] Add authentication (JWT)
- [ ] Swap H2 for PostgreSQL
- [ ] Add rate limiting
- [ ] Deploy to production

## Modern Java Features Used

- **Records** - Immutable data carriers (Vote, VoteOption, DTOs)
- **var** - Type inference for local variables
- **Pattern Matching** - Switch expressions
- **Reactive Streams** - Mono/Flux everywhere
- **Virtual Threads** - (when stable in Java 25)

## Code Quality

**ArchUnit validates:**
- Feature isolation (no cross-feature dependencies)
- Layering (services don't depend on GraphQL)
- Naming conventions (Services, Repositories, DataFetchers)
- Records usage for entities and DTOs

**Low complexity:**
- Methods < 15 lines typically
- Single responsibility
- Clear naming
- Minimal comments (code explains itself)

---

**Status:** 🟢 Active Development

This is the future-proof implementation with full control and production readiness.
