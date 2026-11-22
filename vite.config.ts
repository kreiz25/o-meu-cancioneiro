import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['cancioneiro.svg'],
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
      icons: [{ src: 'cancioneiro.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
    },
    workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,svg,webmanifest}'] }
  })]
})
