import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The client always calls the API on its own origin. In development Vite
// forwards /api to the Java server, so the voter cookie and the live-results
// streams work without any CORS setup. Server-sent events are plain HTTP, so
// the proxy needs no WebSocket support. What the server writes for agents
// (/llms.txt, the OpenAPI document) is forwarded too, as the deployed site's
// reverse proxy does (deploy/Caddyfile).
const server = 'http://127.0.0.1:8080';
const api = { '/api': server, '/llms.txt': server, '/v3/api-docs': server };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // reachable from a phone on the same network
    proxy: api,
    // The tests read deploy/Caddyfile, whose content security policy must allow index.html's script.
    fs: { allow: ['.', '../../deploy'] },
  },
  preview: {
    port: 5173,
    host: true,
    proxy: api,
  },
  test: {
    environment: 'jsdom',
    // Testing Library unmounts between tests only when it finds a global
    // afterEach; without this, one test's DOM is still there in the next.
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
    coverage: {
      include: ['src/**'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    },
  },
});
