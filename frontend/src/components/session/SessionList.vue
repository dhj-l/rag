<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useSessionStore } from '@/stores/session';
import SessionItem from './SessionItem.vue';

const sessionStore = useSessionStore();

const sessions = computed(() => sessionStore.sessions);
const currentId = computed(() => sessionStore.current?.id);
const loading = computed(() => sessionStore.loading);

async function createSession() {
  const s = await sessionStore.create();
  await sessionStore.select(s.id);
}

async function selectSession(id: string) {
  await sessionStore.select(id);
}

async function renameSession(id: string, currentTitle: string) {
  const title = prompt('新会话标题', currentTitle);
  if (!title || !title.trim()) return;
  await sessionStore.rename(id, title.trim());
}

async function removeSession(id: string) {
  if (!confirm('确定删除该会话及其消息？')) return;
  await sessionStore.remove(id);
}

onMounted(() => {
  void sessionStore.fetchList();
});
</script>

<template>
  <div class="flex h-full flex-col bg-white">
    <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
      <span class="text-sm font-semibold text-slate-700">会话</span>
      <button
        class="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
        @click="createSession"
      >
        + 新建
      </button>
    </div>

    <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
      <div v-if="loading && !sessions.length" class="px-2 py-4 text-center text-xs text-slate-400">
        加载中…
      </div>
      <div v-else-if="!sessions.length" class="px-2 py-8 text-center text-xs text-slate-400">
        暂无会话，点击「新建」开始对话
      </div>
      <SessionItem
        v-for="s in sessions"
        :key="s.id"
        :session="s"
        :active="s.id === currentId"
        @select="selectSession(s.id)"
        @rename="renameSession(s.id, s.title)"
        @remove="removeSession(s.id)"
      />
    </div>
  </div>
</template>
