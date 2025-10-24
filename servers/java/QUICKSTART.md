# Java Server Quick Start

## Prerequisites

- **Java 25** (or Java 21+ with `--enable-preview`)
- **Maven 3.9+**

## Install Java 25

### macOS (via Homebrew)
```bash
brew install openjdk@25
```

### Linux/Windows
Download from https://jdk.java.net/25/

## Run the Server

```bash
cd java-server
./mvnw spring-boot:run
```

Server starts on **http://localhost:8080**

## Test with GraphiQL

Open http://localhost:8080/graphiql in your browser.

### Query: Get Server Info
```graphql
query {
  serverInfo {
    maxOptions
    features {
      publicVotes
      ipLimiting
      approvalVoting
      majorityJudgment
    }
  }
}
```

### Mutation: Create a Vote
```graphql
mutation {
  createVote(input: {
    title: "Best Programming Language"
    options: ["Java", "Rust", "TypeScript", "Go"]
    visibility: PUBLIC
    votingSystem: APPROVAL
    limitByIp: true
  }) {
    vote {
      id
      title
      shareToken
      options {
        label
        orderIndex
      }
    }
    error
  }
}
```

### Query: List Public Votes
```graphql
query {
  publicVotes {
    id
    title
    createdAt
    options {
      label
      approvalsCount
    }
  }
}
```

### Subscription: Watch Vote Updates (Real-time!)
```graphql
subscription {
  publicVoteCreated {
    id
    title
    createdAt
  }
}
```

## Run Tests

```bash
# All tests
./mvnw test

# Just architecture tests
./mvnw test -Dtest=ArchitectureTest

# With coverage
./mvnw verify
```

## Package for Production

```bash
./mvnw clean package

# Run the JAR
java -jar target/zvote-server-0.1.0-SNAPSHOT.jar
```

## Environment Variables

```bash
# Change port
SERVER_PORT=9000 ./mvnw spring-boot:run

# Use PostgreSQL instead of H2
SPRING_R2DBC_URL=r2dbc:postgresql://localhost:5432/zvote \
SPRING_R2DBC_USERNAME=zvote \
SPRING_R2DBC_PASSWORD=secret \
./mvnw spring-boot:run
```

## Database Console

H2 console available at: http://localhost:8080/h2-console

- **JDBC URL:** `jdbc:h2:mem:zvote`
- **User:** `sa`
- **Password:** (empty)

## Actuator Endpoints

- **Health:** http://localhost:8080/actuator/health
- **Info:** http://localhost:8080/actuator/info

## Common Issues

### Java Version

```bash
# Check version
java -version

# Should show Java 25 (or 21+ with preview)
```

### Port Already in Use

```bash
# Change port
SERVER_PORT=8081 ./mvnw spring-boot:run
```

### Build Errors

```bash
# Clean and rebuild
./mvnw clean install
```

## What's Next?

1. ✅ Server running
2. Implement approval voting feature
3. Implement majority judgment feature
4. Create client abstraction layer
5. Connect React client

See `README.md` for full documentation.

---

**Quick Test Workflow:**

```bash
# Terminal 1: Run server
cd java-server
./mvnw spring-boot:run

# Terminal 2: Test with curl
curl -X POST http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ serverInfo { maxOptions } }"}'

# Or open GraphiQL in browser
open http://localhost:8080/graphiql
```

🎉 **You're ready to develop!**
