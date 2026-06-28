<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Message } from '@/types';
import { useMarkdown } from '@/composables/useMarkdown';
import SourceReferences from './SourceReferences.vue';

const props = defineProps<{
  message: Message;
  /** 是否为流式生成中的占位消息 */
  streaming?: boolean;
  /** 流式状态下的工具提示 */
  toolHint?: string;
}>();

const { render } = useMarkdown();
const isAssistant = computed(() => props.message.role === 'assistant');

const renderedHtml = computed(() => {
  if (!isAssistant.value) return '';
  return render(props.message.content);
});

const showSources = ref(false);
</script>

<template>
  <div class="flex animate-slide-in" :class="isAssistant ? 'justify-start' : 'justify-end'">
    <div class="max-w-[80%]">
      <!-- 用户消息 -->
      <div
        v-if="!isAssistant"
        class="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white shadow-soft"
      >
        {{ message.content }}
      </div>

      <!-- 助手消息 -->
      <div
        v-else
        class="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-soft ring-1 ring-slate-200/70"
      >
        <div v-if="message.content" class="prose-chat" v-html="renderedHtml"></div>

        <!-- 流式打字光标 + 工具提示 -->
        <div v-if="streaming" class="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span v-if="toolHint">{{ toolHint }}</span>
          <span v-if="!message.content && !toolHint">思考中…</span>
          <span
            v-if="message.content"
            class="inline-block h-4 w-0.5 animate-caret-blink bg-brand-500 align-middle"
          ></span>
        </div>

        <!-- 来源引用 -->
        <SourceReferences
          v-if="message.sources && message.sources.length"
          :sources="message.sources"
          v-model:open="showSources"
        />
      </div>
    </div>
  </div>
</template>
