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
      path: '/',
      name: 'Home',
      component: () => import('@/views/HomeView.vue'),
    },
    // 404 兜底
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

/** 路由守卫（T02 实现要点 6）：未登录 → /login；已登录访问 /login → / */
router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();
  const loggedIn = authStore.isLoggedIn;

  if (to.path === '/login') {
    return loggedIn ? next('/') : next();
  }

  if (!to.meta.public && !loggedIn) {
    return next('/login');
  }

  next();
});

export default router;
