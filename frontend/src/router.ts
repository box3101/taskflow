import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('./views/LoginView.vue'),
    },
    {
      path: '/',
      component: () => import('./layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          component: () => import('./components/dashboard/DashboardHome.vue'),
        },
        {
          path: 'calendar',
          component: () => import('./views/CalendarView.vue'),
        },
        {
          path: 'ai-tools',
          component: () => import('./views/AiToolsView.vue'),
        },
        {
          path: 'projects',
          component: () => import('./views/ProjectsView.vue'),
        },
        {
          path: 'projects/:id',
          component: () => import('./views/ProjectDetailView.vue'),
        },
        {
          path: 'todos',
          component: () => import('./views/TodosView.vue'),
        },
        {
          path: 'health',
          component: () => import('./views/HealthView.vue'),
        },
        {
          path: 'memos',
          component: () => import('./views/MemosView.vue'),
        },
        {
          path: 'stock',
          component: () => import('./views/StockView.vue'),
        },
        {
          path: 'settings',
          component: () => import('./views/SettingsView.vue'),
        },
      ],
    },
    // 기존 /main 경로 호환 → /projects로 리다이렉트
    {
      path: '/main',
      redirect: (to) => {
        const tab = to.query.tab as string
        if (tab === 'todos') return '/todos'
        if (tab === 'stock') return '/stock'
        if (tab === 'ai-tools') return '/ai-tools'
        if (tab === 'calendar') return '/calendar'
        return '/projects'
      },
    },
  ],
})

// 로그인 안 했으면 /login으로 리다이렉트
router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    return '/login'
  }
})

export default router
