# ZVote Quick Start

Choose your backend and run one command!

## 🔵 SpacetimeDB Backend

```bash
./go-spacetime.sh
```

**What it does:**
1. Builds SpacetimeDB module
2. Starts SpacetimeDB server
3. Publishes module
4. Configures client for SpacetimeDB
5. Starts dev server on http://localhost:5173

**Client config:** Uses env vars (no .env files). Same-origin `/v1` proxied to SpacetimeDB.

## 🟢 Java GraphQL Backend

```bash
./go-java.sh
```

**What it does:**
1. Starts Java Spring Boot server (port 8080)
2. Waits for server to be ready
3. Configures client for Java GraphQL
4. Starts dev server on http://localhost:5173

**Client config:** Uses env vars (no .env files). Same-origin `/graphql` proxied to Java.

## 🛠️ Manual Scripts

### Start Servers Individually

**SpacetimeDB:**
```bash
cd scripts
./build_stbd_module.sh
./start_stdb_and_publish_module.sh
```

**Java:**
```bash
cd scripts
./start_java_server.sh
```

### Start Client with Specific Backend (no .env files)

**SpacetimeDB client:**
```bash
cd scripts
VITE_STDB_PORT=3000 ./build_and_run_client_spacetime.sh
```

**Java GraphQL client:**
```bash
cd scripts
VITE_GRAPHQL_PORT=8080 ./build_and_run_client_java.sh
```

## 🎯 What Gets Configured

The client uses environment variables for development only (no `.env` files):

**SpacetimeDB:**
- `VITE_BACKEND_TYPE=spacetime`
- `VITE_STDB_PORT=3000` (Vite proxy target)

**Java GraphQL:**
- `VITE_BACKEND_TYPE=graphql`
- `VITE_GRAPHQL_PORT=8080` (Vite proxy target)

## 📦 Build-Time Optimization

The client is built with **only the selected backend code**:

- SpacetimeDB build: Excludes Apollo Client (~100kb savings)
- Java GraphQL build: Excludes SpacetimeDB SDK (~50kb savings)

## 🔄 Switching Backends

Just run the other script! Each one:
1. Stops existing processes
2. Reconfigures client
3. Starts new backend + client

```bash
# Using SpacetimeDB
./go-spacetime.sh
# Ctrl+C to stop

# Switch to Java
./go-java.sh
```

## 🚦 Ports

- **Client:** http://localhost:5173
- **SpacetimeDB:** ws://localhost:3000 (proxied as same-origin `/v1` in dev)
- **Java GraphQL:** http://localhost:8080 (proxied as same-origin `/graphql` in dev)

## 📝 Requirements

**SpacetimeDB:**
- SpacetimeDB CLI installed
- Rust toolchain
- Node.js & npm

**Java GraphQL:**
- Java 21+
- Maven
- Node.js & npm

## 🆘 Troubleshooting

**Port already in use:**
```bash
# Scripts automatically clean up ports
# If issues persist, manually kill:
lsof -ti:5173 | xargs kill -9
lsof -ti:8080 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

**Java server won't start:**
```bash
cd java-server
mvn clean install
mvn spring-boot:run
```

**SpacetimeDB issues:**
```bash
spacetime server stop
rm -rf ~/.spacetime  # Nuclear option - resets everything
```

## 🎉 That's It!

Choose backend → Run one script → Start coding!
