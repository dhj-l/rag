<script setup lang="ts">
import { ref } from 'vue';
import { ArrowUpOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
}>();

const text = ref('');

function submit() {
  const msg = text.value.trim();
  if (!msg || props.disabled) return;
  emit('send', msg);
  text.value = '';
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="border-t border-slate-200 bg-white px-4 pb-3 pt-3">
    <div class="mx-auto max-w-3xl">
      <div
        class="rounded-2xl border border-slate-200 bg-white shadow-soft transition-all focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100"
      >
        <a-textarea
          v-model:value="text"
          :disabled="disabled"
          :auto-size="{ minRows: 1, maxRows: 5 }"
          :bordered="false"
          placeholder="输入消息，向文档助手提问…"
          style="resize: none; box-shadow: none; padding: 10px 14px;"
          @keydown="onKeydown"
        />
        <div class="flex items-center justify-between px-2.5 pb-2">
          <span class="text-[11px] text-slate-400">Enter 发送 · Shift+Enter 换行</span>
          <a-button
            type="primary"
            shape="circle"
            :disabled="!text.trim() || disabled"
            @click="submit"
          >
            <template #icon><ArrowUpOutlined /></template>
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>
