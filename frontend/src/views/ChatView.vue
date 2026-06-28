<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import SessionList from '@/components/session/SessionList.vue';
import ChatPanel from '@/components/chat/ChatPanel.vue';
import DocumentList from '@/components/document/DocumentList.vue';

/**
 * 主对话页（§5.3 T05 要点1：三栏式布局）
 * 左栏会话列表 280px / 中栏对话区 flex-1 / 右栏文档区 320px
 */
const route = useRoute();
const router = useRouter();
const sessionStore = useSessionStore();

// 路由参数同步当前会话
async function syncSessionFromRoute() {
  const id = route.params.id as string | undefined;
  if (id) {
    await sessionStore.select(id);
  }
}

watch(() => route.params.id, syncSessionFromRoute);
onMounted(syncSessionFromRoute);

// 选中会话后同步路由
watch(
  () => sessionStore.current?.id,
  (id) => {
    if (id && route.params.id !== id) {
      void router.replace(`/chat/${id}`);
    }
  },
);
</script>

<template>
  <div class="flex h-full">
    <!-- 左栏：会话列表 -->
    <aside class="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <SessionList />
    </aside>

    <!-- 中栏：对话区 -->
    <section class="min-w-0 flex-1 bg-slate-50 dark:bg-slate-950">
      <ChatPanel />
    </section>

    <!-- 右栏：文档区 -->
    <aside class="flex w-[320px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <DocumentList />
    </aside>
  </div>
</template>
