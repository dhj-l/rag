<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useSessionStore } from '@/stores/session';
import { useChat } from '@/composables/useChat';
import MessageBubble from './MessageBubble.vue';
import ChatInput from './ChatInput.vue';

const sessionStore = useSessionStore();
const {
  isStreaming,
  streamingMessage,
  currentToolHint,
  error,
  send,
  abort,
} = useChat();

const scrollRef = ref<HTMLElement | null>(null);

const current = computed(() => sessionStore.current);
const messages = computed(() => current.value?.messages ?? []);

async function scrollToBottom() {
  await nextTick();
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
}

// 消息变化或流式内容更新时滚动到底
watch(
  () => [messages.value.length, streamingMessage.value?.content, currentToolHint.value],
  () => scrollToBottom(),
);

onMounted(() => scrollToBottom());
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
    <!-- 空状态 -->
    <div v-if="!current" class="flex flex-1 items-center justify-center text-sm text-slate-400">
      请从左侧选择或新建一个会话开始对话
    </div>

    <template v-else>
      <!-- 会话标题栏 -->
      <div class="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-4">
        <span class="truncate text-sm font-medium text-slate-700">{{ current.title }}</span>
      </div>

      <!-- 消息流 -->
      <div ref="scrollRef" class="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div v-if="!messages.length && !isStreaming" class="flex h-full items-center justify-center text-sm text-slate-400">
          输入消息开始与文档助手对话
        </div>

        <MessageBubble
          v-for="m in messages"
          :key="m.id"
          :message="m"
        />

        <!-- 流式生成中的助手占位消息 -->
        <MessageBubble
          v-if="streamingMessage"
          :message="streamingMessage"
          :streaming="true"
          :tool-hint="currentToolHint"
        />

        <!-- 错误提示 -->
        <div v-if="error" class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          ⚠️ {{ error }}
        </div>
      </div>

      <!-- 输入区 -->
      <ChatInput :disabled="isStreaming" @send="send" />
      <div v-if="isStreaming" class="flex items-center justify-between bg-white px-3 pb-2 text-xs text-slate-400">
        <span>正在生成回复…</span>
        <button class="text-red-500 hover:underline" @click="abort">停止</button>
      </div>
    </template>
  </div>
</template>
