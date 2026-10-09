import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The client always calls the API on its own origin. In development Vite
// forwards /api to the Java server, so the voter cookie and the live-results
// streams work without any CORS setup. Server-sent events are plain HTTP, so
// the proxy needs no WebSocket support.
const api = { '/api': 'http://127.0.0.1:8080' };

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // reachable from a phone on the same network
    proxy: api,
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
