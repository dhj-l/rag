import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/chat/:id?',
      name: 'Chat',
      component: () => import('@/views/ChatView.vue'),
    },
    {
      path: '/admin',
      name: 'Admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAdmin: true },
    },
    // 根路径重定向到对话页
    { path: '/', redirect: '/chat' },
    // 404 兜底
    { path: '/:pathMatch(.*)*', redirect: '/chat' },
  ],
});

/**
 * 路由守卫（T02 实现要点 6 + T05 管理员守卫）
 * - 未登录访问受保护页 → /login
 * - 已登录访问 /login → /chat
 * - 非管理员访问 /admin → /chat
 */
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  const loggedIn = authStore.isLoggedIn;

  if (to.path === '/login') {
    return loggedIn ? next('/chat') : next();
  }

  if (!to.meta.public && !loggedIn) {
    return next('/login');
  }

  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    return next('/chat');
  }

  next();
});

export default router;
