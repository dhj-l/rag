<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
}>();

const text = ref('');

const canSend = computed(() => text.value.trim().length > 0 && !props.disabled);

function submit() {
  if (!canSend.value) return;
  emit('send', text.value.trim());
  text.value = '';
}

function onKeydown(e: KeyboardEvent) {
  // 回车发送，Shift+Enter 换行（§5.3 T05 要点 8）
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="border-t border-slate-200 bg-white p-3">
    <div class="flex items-end gap-2">
      <textarea
        v-model="text"
        :disabled="disabled"
        rows="1"
        placeholder="输入消息，回车发送，Shift+Enter 换行"
        class="scrollbar-thin max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent disabled:bg-slate-50"
        @keydown="onKeydown"
      ></textarea>
      <button
        :disabled="!canSend"
        class="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
        @click="submit"
      >
        发送
      </button>
    </div>
  </div>
</template>
