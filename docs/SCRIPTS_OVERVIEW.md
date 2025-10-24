# Scripts Overview

## 📁 Script Structure

```
zvote/
├── go-spacetime.sh              # 🔵 One-command SpacetimeDB start
├── go-java.sh                   # 🟢 One-command Java start
└── scripts/
    ├── build_stbd_module.sh                    # Build SpacetimeDB module
    ├── start_stdb_and_publish_module.sh        # Start SpacetimeDB
    ├── start_java_server.sh                    # Start Java server
    ├── build_and_run_client_spacetime.sh       # Client → SpacetimeDB
    ├── build_and_run_client_java.sh            # Client → Java GraphQL
    └── build_and_run_client.sh                 # Legacy (test build)
```

## 🎯 Main Scripts

### `./go-spacetime.sh`

```bash
./go-spacetime.sh
```

**Flow:**
```
1. Build SpacetimeDB module (Rust)
2. Start SpacetimeDB server
3. Publish module to SpacetimeDB
4. Start Vite dev server (port 5173)
   - Uses env vars: `VITE_BACKEND_TYPE=spacetime`, `VITE_STDB_PORT=3000`
```

**Client Bundle:**
- Includes: SpacetimeDB SDK
- Excludes: Apollo Client, GraphQL
- **Result:** ~100kb smaller

### `./go-java.sh`

```bash
./go-java.sh
```

**Flow:**
```
1. Start Java Spring Boot server (port 8080)
2. Wait for server health check
3. Start Vite dev server (port 5173)
   - Uses env vars: `VITE_BACKEND_TYPE=graphql`, `VITE_GRAPHQL_PORT=8080`
```

**Client Bundle:**
- Includes: Apollo Client, GraphQL
- Excludes: SpacetimeDB SDK
- **Result:** ~50kb smaller

## 🔧 Helper Scripts

### `scripts/start_java_server.sh`

Starts Java Spring Boot server:
- Checks for Maven and Java
- Runs `mvn spring-boot:run`
- Server on http://localhost:8080

### `scripts/build_and_run_client_spacetime.sh`

Configures and starts client for SpacetimeDB:
- Uses env vars (`VITE_BACKEND_TYPE=spacetime`, `VITE_STDB_PORT`)
- Cleans up old processes
- Runs `npm run dev:spacetime`

### `scripts/build_and_run_client_java.sh`

Configures and starts client for Java:
- Uses env vars (`VITE_BACKEND_TYPE=graphql`, `VITE_GRAPHQL_PORT`)
- Cleans up old processes
- Runs `npm run dev:graphql`

## 🔄 Configuration Flow

### SpacetimeDB Config (Dev)

```bash
# Dev server
VITE_BACKEND_TYPE=spacetime VITE_STDB_PORT=3000 npm run dev:spacetime
# Factory selects SpacetimeBackend at build-time
```

### Java GraphQL Config (Dev)

```bash
# Dev server
VITE_BACKEND_TYPE=graphql VITE_GRAPHQL_PORT=8080 npm run dev:graphql
# Factory selects GraphQLBackend at build-time
```

## 🎨 Visual Flow

### SpacetimeDB Flow

```
./go-spacetime.sh
     │
     ├─→ Build Rust module
     ├─→ Start SpacetimeDB (ws://localhost:3000)
     ├─→ Publish module
     └─→ Start dev server (http://localhost:5173)
           (env: VITE_BACKEND_TYPE=spacetime, VITE_STDB_PORT=3000)
              ↓
         SpacetimeBackend loaded
         GraphQL code excluded
         ~100kb saved ✨
```

### Java GraphQL Flow

```
./go-java.sh
     │
     ├─→ Start Java server (http://localhost:8080)
     ├─→ Wait for health check
     └─→ Start dev server (http://localhost:5173)
           (env: VITE_BACKEND_TYPE=graphql, VITE_GRAPHQL_PORT=8080)
              ↓
         GraphQLBackend loaded
         SpacetimeDB code excluded
         ~50kb saved ✨
```

## 🚀 Quick Commands

```bash
# Start with SpacetimeDB
./go-spacetime.sh

# Stop (Ctrl+C), then start with Java
./go-java.sh

# Manual: Start servers separately
cd scripts
./start_java_server.sh          # Java only
./start_stdb_and_publish_module.sh  # SpacetimeDB only

# Manual: Start client with specific config
cd scripts
./build_and_run_client_java.sh       # Client → Java
./build_and_run_client_spacetime.sh  # Client → SpacetimeDB
```

## 🧹 Cleanup Features

All client scripts automatically:
- Kill processes on port 5173
- Kill stray npm dev processes
- Ensure clean state before starting

## 🎯 Benefits

1. **One command** - No manual configuration
2. **Auto-config** - Client configures automatically
3. **Optimized bundles** - Only needed code included
4. **Easy switching** - Just run different script
5. **Clean state** - Auto-cleanup prevents conflicts

## 📊 Port Map

| Service | Port | Access |
|---------|------|--------|
| Vite Dev Server | 5173 | http://localhost:5173 |
| Java Spring Boot | 8080 | http://localhost:8080 |
| SpacetimeDB | 3000 | ws://localhost:3000 |
| GraphQL Playground | 8080 | http://localhost:8080/graphiql |

## 🔍 Debugging

**Check what's running:**
```bash
lsof -i :5173  # Vite
lsof -i :8080  # Java
lsof -i :3000  # SpacetimeDB
```

**Kill everything:**
```bash
pkill -f "npm.*dev"
pkill -f "mvn"
spacetime server stop
```

**Check client config:**
Client now uses env vars at launch time (no `.env` files). See `client/package.json` scripts and `client/vite.config.ts` proxies.

## 🎓 Summary

- **`./go-spacetime.sh`** → Complete SpacetimeDB setup
- **`./go-java.sh`** → Complete Java GraphQL setup
- **Scripts auto-configure client** → No manual `.env` editing
- **Optimized bundles** → Tree-shaking eliminates unused code
- **Easy switching** → Stop one, start other

**Choose backend → Run one command → Done!** ✨
