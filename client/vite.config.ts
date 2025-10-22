import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // No alias needed - using the correct 'spacetimedb' package now!
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/v1': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})
