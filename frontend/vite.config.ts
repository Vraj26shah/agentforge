import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://host.docker.internal:8001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://host.docker.internal:8001',
        ws: true,
        changeOrigin: true,
      },
      '/health': {
        target: 'http://host.docker.internal:8001',
        changeOrigin: true,
      },
    },
  },
})
