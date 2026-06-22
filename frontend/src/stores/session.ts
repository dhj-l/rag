import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  createSession as apiCreateSession,
  listSessions as apiListSessions,
  getSession as apiGetSession,
  renameSession as apiRenameSession,
  deleteSession as apiDeleteSession,
} from '@/api/session';
import type { Session, SessionDetail } from '@/types';

/**
 * 会话 Store（T04）
 *
 * 管理会话列表与当前会话（含消息历史）状态。
 * 聊天页面（T05）基于此 Store 渲染侧边栏与对话区。
 */
export const useSessionStore = defineStore('session', () => {
  const sessions = ref<Session[]>([]);
  const current = ref<SessionDetail | null>(null);
  const loading = ref(false);

  async function fetchList(params?: { page?: number; pageSize?: number }): Promise<void> {
    loading.value = true;
    try {
      const result = await apiListSessions(params);
      sessions.value = result.list;
    } finally {
      loading.value = false;
    }
  }

  async function create(title?: string): Promise<Session> {
    const session = await apiCreateSession(title);
    sessions.value.unshift(session);
    return session;
  }

  async function select(id: string): Promise<void> {
    loading.value = true;
    try {
      current.value = await apiGetSession(id);
    } finally {
      loading.value = false;
    }
  }

  async function rename(id: string, title: string): Promise<void> {
    const updated = await apiRenameSession(id, title);
    const idx = sessions.value.findIndex((s) => s.id === id);
    if (idx >= 0) sessions.value[idx] = updated;
    if (current.value?.id === id) current.value = { ...current.value, title: updated.title };
  }

  async function remove(id: string): Promise<void> {
    await apiDeleteSession(id);
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (current.value?.id === id) current.value = null;
  }

  return { sessions, current, loading, fetchList, create, select, rename, remove };
});
