import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the Go service runs on its own port. In production nginx
    // serves the page and /api/* from one origin, so the client uses relative URLs.
    // API_PROXY_TARGET points the dev server at a backend on another port.
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8081' },
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
})
