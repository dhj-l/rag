<script setup lang="ts">
import { computed } from 'vue';
import type { Session } from '@/types';

const props = defineProps<{
  session: Session;
  active: boolean;
}>();

const emit = defineEmits<{
  select: [];
  rename: [];
  remove: [];
}>();

const time = computed(() => {
  const d = new Date(props.session.lastMessageAt);
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) +
    ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
});
</script>

<template>
  <div
    class="group relative flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 transition-colors"
    :class="active ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'"
    @click="emit('select')"
  >
    <span class="text-sm">💬</span>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium">{{ session.title || '新会话' }}</div>
      <div class="truncate text-xs text-slate-400">{{ time }}</div>
    </div>
    <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        class="rounded p-1 text-slate-400 hover:bg-white hover:text-brand-600"
        title="重命名"
        @click.stop="emit('rename')"
      >
        ✏️
      </button>
      <button
        class="rounded p-1 text-slate-400 hover:bg-white hover:text-red-600"
        title="删除"
        @click.stop="emit('remove')"
      >
        🗑️
      </button>
    </div>
  </div>
</template>
