import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Las pruebas de dominio son funciones puras: no hace falta DOM. Cuando
    // toque probar los adaptadores de Dexie, ese archivo pedirá su propio
    // entorno con `// @vitest-environment`.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
