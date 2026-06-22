<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABELS } from '@/constants';

/**
 * 应用外壳布局（§5.3 T05）
 *
 * 顶部导航栏（logo / 对话·管理后台入口 / 用户信息 / 登出）+ 主内容区。
 * 三栏式对话布局由 ChatView 内部实现；本组件仅提供统一外壳。
 */
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const user = computed(() => authStore.user);
const isAdmin = computed(() => authStore.isAdmin);
const isChatActive = computed(() => route.name === 'Chat');
const isAdminActive = computed(() => route.name === 'Admin');

function goChat() {
  void router.push('/chat');
}

function goAdmin() {
  void router.push('/admin');
}

function logout() {
  authStore.logout();
  void router.push('/login');
}
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-50">
    <!-- 顶部导航栏 -->
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div class="flex items-center gap-6">
        <div class="flex items-center gap-2">
          <span class="text-lg">📚</span>
          <span class="text-base font-semibold text-slate-800">智能文档助手</span>
        </div>
        <nav class="flex items-center gap-1">
          <button
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="isChatActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'"
            @click="goChat"
          >
            对话
          </button>
          <button
            v-if="isAdmin"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="isAdminActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'"
            @click="goAdmin"
          >
            管理后台
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <div class="text-right text-xs leading-tight">
          <div class="font-medium text-slate-700">{{ user?.displayName || user?.username }}</div>
          <div class="text-slate-400">
            {{ ROLE_LABELS[user?.role ?? ''] || user?.role }}
            <span v-if="user?.departments?.length">· {{ user.departments.join('、') }}</span>
          </div>
        </div>
        <button
          class="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
          @click="logout"
        >
          登出
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="min-h-0 flex-1 overflow-hidden">
      <slot />
    </main>
  </div>
</template>
