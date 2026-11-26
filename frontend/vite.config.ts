import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // The repo's one .env (see .env.example). The '' prefix loads names without
  // VITE_, which stay in this config and never reach the app.
  const env = loadEnv(mode, resolve(import.meta.dirname, '..'), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // The client uses relative /api URLs, which nginx serves in production.
      // In development they go to the Go service at API_PROXY_TARGET.
      proxy: { '/api': env.API_PROXY_TARGET || 'http://127.0.0.1:8081' },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      },
    },
  }
})
