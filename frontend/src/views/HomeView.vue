<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

function handleLogout(): void {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200">
    <div class="w-full max-w-md bg-white rounded-lg shadow-md p-8 text-center">
      <h1 class="text-2xl font-bold text-slate-800 mb-4">智能文档助手</h1>
      <p class="text-slate-600 mb-6">欢迎，{{ authStore.user?.displayName || authStore.user?.username }}</p>

      <div class="text-left space-y-2 mb-6 bg-slate-50 rounded-md p-4">
        <p class="text-sm text-slate-500">
          <span class="font-medium text-slate-700">用户名：</span>{{ authStore.user?.username }}
        </p>
        <p class="text-sm text-slate-500">
          <span class="font-medium text-slate-700">角色：</span>{{ authStore.user?.role }}
        </p>
        <p class="text-sm text-slate-500">
          <span class="font-medium text-slate-700">部门：</span>{{ authStore.user?.departments?.join('、') || '无' }}
        </p>
      </div>

      <p class="text-sm text-slate-400 mb-4">对话与文档管理功能将在后续版本发布</p>

      <button
        @click="handleLogout"
        class="px-6 py-2 bg-slate-600 text-white font-medium rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 transition-colors"
      >
        退出登录
      </button>
    </div>
  </div>
</template>
