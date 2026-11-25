import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['cancioneiro.svg', 'apple-touch-icon-v2.png', 'cancioneiro-192-v2.png', 'cancioneiro-512-v2.png'],
    manifest: {
      id: './',
      name: 'O Meu Cancioneiro',
      short_name: 'Cancioneiro',
      lang: 'gl',
      description: 'Cancións, acordes e repertorios no teu dispositivo.',
      theme_color: '#f7f5ef',
      background_color: '#f7f5ef',
      display: 'standalone',
      start_url: './',
      icons: [
        { src: 'cancioneiro-192-v2.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'cancioneiro-512-v2.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] }
  })]
})
