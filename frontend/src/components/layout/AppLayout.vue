<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useThemeStore } from '@/stores/theme';
import { ROLE_LABELS } from '@/constants';
import {
  ReadOutlined,
  MessageOutlined,
  SettingOutlined,
  LogoutOutlined,
  DownOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons-vue';

const authStore = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();
const route = useRoute();

const user = computed(() => authStore.user);
const isAdmin = computed(() => authStore.isAdmin);
const isDark = computed(() => themeStore.isDark);

interface NavItem {
  key: string;
  label: string;
  icon: typeof MessageOutlined;
  to: string;
}

const navItems = computed<NavItem[]>(() => {
  const items: NavItem[] = [
    { key: 'chat', label: '对话', icon: MessageOutlined, to: '/chat' },
  ];
  if (isAdmin.value) {
    items.push({ key: 'documents', label: '文档管理', icon: FileTextOutlined, to: '/documents' });
    items.push({ key: 'admin', label: '管理后台', icon: SettingOutlined, to: '/admin' });
  }
  return items;
});

const activeKey = computed(() => {
  const map: Record<string, string> = {
    Chat: 'chat',
    Documents: 'documents',
    Admin: 'admin',
  };
  return map[route.name as string] ?? 'chat';
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

function navigate(item: NavItem) {
  void router.push(item.to);
}

function logout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <a-layout class="h-screen">
    <a-layout-header
      class="glass sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/70 px-4 dark:border-slate-800/70"
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
            <div class="text-[15px] font-semibold text-slate-900 dark:text-slate-100">智能文档助手</div>
            <div class="-mt-0.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">RAG 知识库</div>
          </div>
        </div>

        <!-- 自定义 pill 导航（比 antd menu 更可控、更精致） -->
        <nav class="flex items-center gap-1">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            :class="[
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200',
              activeKey === item.key
                ? 'bg-brand-50 text-brand-700 shadow-soft dark:bg-brand-500/15 dark:text-brand-300'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
            ]"
            @click="navigate(item)"
          >
            <component :is="item.icon" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </div>

      <div class="flex items-center gap-1">
        <!-- 深色模式切换（SVG 太阳/月亮，stroke 风格与 antd outline 一致） -->
        <button
          type="button"
          class="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          :title="isDark ? '切换到浅色' : '切换到深色'"
          :aria-label="isDark ? '切换到浅色模式' : '切换到深色模式'"
          @click="themeStore.toggle()"
        >
          <!-- 浅色下显示月亮（点 → 进深色）；深色下显示太阳 -->
          <svg
            v-if="!isDark"
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </button>

        <!-- 用户区：头像下拉 -->
        <a-dropdown placement="bottomRight" :trigger="['click']">
          <div
            class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <div
              class="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white shadow-soft"
            >
              {{ initial }}
            </div>
            <div class="hidden text-right leading-tight sm:block">
              <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {{ user?.displayName || user?.username }}
              </div>
              <div class="text-[11px] text-slate-400 dark:text-slate-500">
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
                <span class="ml-[18px] text-slate-500 dark:text-slate-400">
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
      </div>
    </a-layout-header>

    <a-layout-content style="min-height: 0; overflow: hidden;">
      <slot />
    </a-layout-content>
  </a-layout>
</template>
