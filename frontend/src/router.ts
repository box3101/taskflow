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
      component: () => import('./views/ProjectsView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/projects/:id',
      component: () => import('./views/ProjectDetailView.vue'),
      meta: { requiresAuth: true },
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
