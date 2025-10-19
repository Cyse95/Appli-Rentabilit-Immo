import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// chemin absolu vers ./src sans node:url
const SRC = new URL('./src/', import.meta.url).pathname

export default defineConfig({
  base: '/appli-rentabilit-immo/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': SRC, // ex: import x from '@/components/x'
    },
  },
})
