import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
const backendType = process.env.VITE_BACKEND_TYPE || 'spacetime';
const defaultPort = backendType === 'graphql' ? '8080' : '3000';
const backendPort = process.env.VITE_BACKEND_PORT || defaultPort;

const proxyConfig: Record<string, any> = {};

if (backendType === 'graphql') {
  // Java GraphQL backend
  proxyConfig['/graphql'] = {
    target: `http://127.0.0.1:${backendPort}`,
    changeOrigin: true,
  };
} else {
  // SpacetimeDB backend
  proxyConfig['/v1'] = {
    target: `http://127.0.0.1:${backendPort}`,
    changeOrigin: true,
    ws: true,
  };
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: proxyConfig,
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})
