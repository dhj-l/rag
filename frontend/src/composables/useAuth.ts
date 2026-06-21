import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

/**
 * 认证组合式函数（T02 实现要点 6 / §7.1 composable 命名）
 *
 * - 封装登录表单状态与提交逻辑。
 * - 提供 login / logout 便捷方法，含路由跳转。
 */
export function useAuth() {
  const router = useRouter();
  const authStore = useAuthStore();

  const form = reactive({ username: '', password: '' });
  const loading = ref(false);
  const error = ref('');

  async function login(): Promise<void> {
    if (!form.username || !form.password) {
      error.value = '请输入用户名和密码';
      return;
    }
    loading.value = true;
    error.value = '';
    try {
      await authStore.login(form.username, form.password);
      router.push('/');
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      error.value = e.message ?? '登录失败，请稍后重试';
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    authStore.logout();
    await router.push('/login');
  }

  return { form, loading, error, login, logout, isLoggedIn: authStore.isLoggedIn, isAdmin: authStore.isAdmin, user: authStore.user };
}
