import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'logo.svg'],
      manifest: {
        name: 'TaskFlow',
        short_name: 'TaskFlow',
        description: '개인 업무 기록 & 태스크 관리',
        theme_color: '#1a1f2b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // SPA 라우팅 지원
        navigateFallback: '/index.html',
        // 정적 자산 캐싱
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/uploads': 'http://localhost:4000',
    },
    // dev 서버 시작 시 자주 쓰는 화면을 미리 변환(예열) → 첫 방문 컴파일 대기 감소
    warmup: {
      clientFiles: [
        './src/layouts/AppLayout.vue',
        './src/views/DashboardView.vue',
        './src/components/dashboard/DashboardHome.vue',
        './src/views/CalendarView.vue',
        './src/views/ProjectsView.vue',
        './src/views/TodosView.vue',
      ],
    },
  },
  // 무거운 라이브러리를 dev 서버 시작 때 미리 번들 → 페이지 첫 진입 시 즉석 변환 제거
  optimizeDeps: {
    include: [
      '@leechanyong/ispark-ui',
      '@lucide/vue',
      'axios',
      'marked',
    ],
  },
  resolve: {
    preserveSymlinks: true,
  },
})
