import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { login as apiLogin, getProfile } from '@/api/auth';

interface StoredUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  departments: string[];
}

/**
 * 认证 Store（T02 实现要点 6）
 *
 * - 登录成功保存 token + user 到 localStorage，刷新页不丢。
 * - isLoggedIn / isAdmin 供路由守卫和 UI 使用。
 * - logout 清空状态 + 跳转登录页（由 useAuth 调用）。
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('da_token') ?? '');
  const user = ref<StoredUser | null>(loadUser());

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function login(username: string, password: string): Promise<void> {
    const result = await apiLogin(username, password);
    token.value = result.token;
    const u = result.user;
    user.value = { id: u.id, username: u.username, displayName: u.displayName, role: u.role, departments: u.departments };
    localStorage.setItem('da_token', result.token);
    localStorage.setItem('da_user', JSON.stringify(user.value));
  }

  function logout(): void {
    token.value = '';
    user.value = null;
    localStorage.removeItem('da_token');
    localStorage.removeItem('da_user');
  }

  async function fetchProfile(): Promise<void> {
    const profile = await getProfile();
    user.value = {
      id: profile.userId,
      username: profile.username,
      displayName: '',
      role: profile.role,
      departments: profile.departments,
    };
    localStorage.setItem('da_user', JSON.stringify(user.value));
  }

  return { token, user, isLoggedIn, isAdmin, login, logout, fetchProfile };
});

function loadUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('da_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
