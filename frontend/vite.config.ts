import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  // Settings from the repository's one .env file (see .env.example at the
  // root); a variable set in the shell wins. The '' prefix loads names without
  // VITE_, which the app's code never sees: these are for this config only.
  const env = loadEnv(mode, resolve(import.meta.dirname, '..'), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      // In development the Go service runs on its own port. In production nginx
      // serves the page and /api/* from one origin, so the client uses relative URLs.
      // API_PROXY_TARGET points the dev server at a backend on another port.
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
