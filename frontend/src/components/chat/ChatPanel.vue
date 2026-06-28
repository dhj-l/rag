<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useSessionStore } from '@/stores/session';
import { useChat } from '@/composables/useChat';
import { MessageOutlined } from '@ant-design/icons-vue';
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

watch(
  () => [messages.value.length, streamingMessage.value?.content, currentToolHint.value],
  () => scrollToBottom(),
);

onMounted(() => scrollToBottom());
</script>

<template>
  <div class="flex h-full flex-col bg-slate-50">
    <!-- 无会话 -->
    <div
      v-if="!current"
      class="flex flex-1 flex-col items-center justify-center px-6 text-center"
    >
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
        <MessageOutlined style="font-size: 28px;" />
      </div>
      <p class="mt-4 text-base font-semibold text-slate-700">开始你的第一次对话</p>
      <p class="mt-1.5 text-sm text-slate-400">从左侧选择或新建一个会话</p>
    </div>

    <template v-else>
      <!-- 标题栏 -->
      <div class="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-4">
        <span class="truncate text-sm font-medium text-slate-700">{{ current.title }}</span>
      </div>

      <!-- 消息区 -->
      <div ref="scrollRef" class="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div class="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <!-- 空消息 -->
          <div
            v-if="!messages.length && !isStreaming"
            class="flex flex-col items-center justify-center py-20 text-center"
          >
            <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
              <MessageOutlined style="font-size: 24px;" />
            </div>
            <p class="mt-4 text-sm font-medium text-slate-600">输入消息开始与文档助手对话</p>
            <p class="mt-1 text-xs text-slate-400">基于已上传文档检索作答，并给出引用来源</p>
          </div>

          <MessageBubble v-for="m in messages" :key="m.id" :message="m" />

          <MessageBubble
            v-if="streamingMessage"
            :message="streamingMessage"
            :streaming="true"
            :tool-hint="currentToolHint"
          />

          <a-alert v-if="error" :message="error" type="error" show-icon />
        </div>
      </div>

      <!-- 输入区 -->
      <ChatInput :disabled="isStreaming" @send="send" />

      <!-- 流式状态条 -->
      <div
        v-if="isStreaming"
        class="flex items-center justify-between bg-white px-4 pb-2 text-xs text-slate-400"
      >
        <span class="flex items-center gap-1.5">
          <span class="relative flex h-2 w-2">
            <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75"></span>
            <span class="relative inline-flex h-2 w-2 rounded-full bg-brand-500"></span>
          </span>
          正在生成回复…
        </span>
        <a-button type="link" size="small" danger @click="abort">停止</a-button>
      </div>
    </template>
  </div>
</template>
