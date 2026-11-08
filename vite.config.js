import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'שביל ישראל – מתכנן המסע',
        short_name: 'שביל ישראל',
        description: 'תכנון וביצוע טיול בשביל ישראל: מקטעים, לינה, מים, עונות, מפה, מצפן ו-GPS',
        lang: 'he',
        dir: 'rtl',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b1d33',
        theme_color: '#0b1d33',
        icons: [
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/data/updates.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'live-data', networkTimeoutSeconds: 8, expiration: { maxEntries: 5 } },
          },
          {
            // Map tiles: cache what the user has seen so it works offline on the trail
            urlPattern: ({ url }) =>
              /tile\.openstreetmap\.org|israelhiking\.osm\.org\.il|opentopomap\.org/.test(url.hostname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /wikimedia\.org|wikipedia\.org/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'photos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com/.test(url.hostname),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: ({ url }) => /open-meteo\.com/.test(url.hostname),
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', networkTimeoutSeconds: 6, expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 6 } },
          },
        ],
      },
    }),
  ],
})
