import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' y nunca 'autoUpdate': con actualización automática el service
      // worker puede recargar la app a mitad de una captura, y una recarga
      // inesperada mientras pasa asistencia es motivo de abandono (docs/UX.md).
      registerType: 'prompt',
      // Safari históricamente ha ignorado partes del manifest, así que el
      // apple-touch-icon va además como <link> en el índice.
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: 'Palomita',
        short_name: 'Palomita',
        description: 'Asistencia, calificaciones y bitácora de un grupo',
        lang: 'es-MX',
        theme_color: '#1B4F9C',
        background_color: '#FBFAF7',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Las tipografías y los iconos entran al precaché: la app tiene que
        // arrancar completa en modo avión, sin caer al tipo de letra de respaldo.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
      },
    }),
  ],
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
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // La app se usa en un solo iPad en horario de México, y el manejo de fechas
    // depende de la zona: sin fijarla, las pruebas de `fechaLocal` pasarían
    // igual con una implementación en UTC en cualquier máquina que corra en UTC.
    env: { TZ: 'America/Mexico_City' },
  },
})
