<script setup lang="ts">
import { computed, h } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABELS } from '@/constants';
import {
  ReadOutlined,
  MessageOutlined,
  SettingOutlined,
  LogoutOutlined,
  DownOutlined,
  UserOutlined,
} from '@ant-design/icons-vue';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const user = computed(() => authStore.user);
const isAdmin = computed(() => authStore.isAdmin);

const selectedKeys = computed(() => {
  const map: Record<string, string[]> = {
    Chat: ['chat'],
    Admin: ['admin'],
  };
  return map[route.name as string] ?? ['chat'];
});

const menuItems = computed(() => {
  const items = [{ key: 'chat', icon: h(MessageOutlined), label: '对话' }];
  if (isAdmin.value) {
    items.push({ key: 'admin', icon: h(SettingOutlined), label: '管理后台' });
  }
  return items;
});

// 头像首字母
const initial = computed(() => {
  const name = user.value?.displayName || user.value?.username || '';
  return (name.charAt(0) || '?').toUpperCase();
});

const roleLabel = computed(() => ROLE_LABELS[user.value?.role ?? ''] || user.value?.role || '');
const deptText = computed(() =>
  user.value?.departments?.length ? user.value.departments.join('、') : '',
);

function handleMenuClick(info: { key: string }) {
  if (info.key === 'chat') {
    router.push('/chat');
  } else if (info.key === 'admin') {
    router.push('/admin');
  }
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <a-layout class="h-screen">
    <a-layout-header
      class="flex items-center justify-between px-4"
      style="background: rgba(255, 255, 255, 0.82); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); height: 56px; line-height: 56px; border-bottom: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04); position: relative; z-index: 20;"
    >
      <div class="flex items-center gap-6">
        <!-- 品牌 logo -->
        <div class="flex select-none items-center gap-2.5">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft"
          >
            <ReadOutlined style="font-size: 18px;" />
          </div>
          <div class="leading-tight">
            <div class="text-[15px] font-semibold text-slate-900">智能文档助手</div>
            <div class="-mt-0.5 text-[11px] font-medium text-slate-400">RAG 知识库</div>
          </div>
        </div>

        <a-menu
          mode="horizontal"
          :selected-keys="selectedKeys"
          :items="menuItems"
          style="border: none; flex: 1; min-width: 0; background: transparent;"
          @click="handleMenuClick"
        />
      </div>

      <!-- 用户区：头像下拉 -->
      <a-dropdown placement="bottomRight" :trigger="['click']">
        <div
          class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100"
        >
          <div
            class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-soft"
          >
            {{ initial }}
          </div>
          <div class="hidden text-right leading-tight sm:block">
            <div class="text-xs font-semibold text-slate-700">
              {{ user?.displayName || user?.username }}
            </div>
            <div class="text-[11px] text-slate-400">
              <span>{{ roleLabel }}</span>
              <span v-if="deptText"> · {{ deptText }}</span>
            </div>
          </div>
          <DownOutlined class="text-[10px] text-slate-400" />
        </div>
        <template #overlay>
          <a-menu>
            <a-menu-item key="info" disabled>
              <UserOutlined />
              <span class="ml-2">{{ user?.displayName || user?.username }}</span>
            </a-menu-item>
            <a-menu-item key="role" disabled>
              <span class="ml-[18px] text-slate-500">
                {{ roleLabel }}<span v-if="deptText"> · {{ deptText }}</span>
              </span>
            </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="logout" @click="logout">
              <LogoutOutlined />
              <span class="ml-2">退出登录</span>
            </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
    </a-layout-header>

    <a-layout-content style="min-height: 0; overflow: hidden;">
      <slot />
    </a-layout-content>
  </a-layout>
</template>
