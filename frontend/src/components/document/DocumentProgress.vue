<script setup lang="ts">
import { computed } from 'vue';
import type { DocumentStatus } from '@/types';
import { DOCUMENT_STATUS_META } from '@/constants';

const props = defineProps<{
  status: DocumentStatus;
  chunkCount?: number;
  errorMessage?: string;
}>();

const meta = computed(() => DOCUMENT_STATUS_META[props.status] ?? DOCUMENT_STATUS_META.uploaded);

// 4 阶段进度（§5.3 要点5）
const stages = ['uploaded', 'parsing', 'embedding', 'completed'] as const;
const stageLabels = ['已上传', '解析中', '向量化', '已完成'];
const currentStageIndex = computed(() => {
  if (props.status === 'failed') return -1;
  return stages.indexOf(props.status as (typeof stages)[number]);
});
</script>

<template>
  <div>
    <!-- 失败状态 -->
    <div v-if="status === 'failed'" class="text-xs">
      <span class="rounded px-1.5 py-0.5 font-medium" :class="meta.badge">{{ meta.label }}</span>
      <div v-if="errorMessage" class="mt-1 text-red-500">{{ errorMessage }}</div>
    </div>

    <!-- 进度阶段 -->
    <div v-else class="flex items-center gap-1">
      <template v-for="(s, i) in stageLabels" :key="s">
        <span
          class="h-1.5 w-6 rounded-full transition-colors"
          :class="i <= currentStageIndex ? 'bg-brand-500' : 'bg-slate-200'"
        ></span>
      </template>
      <span class="ml-1.5 text-[11px]" :class="meta.badge.replace('bg-', 'text-').split(' ')[0]">
        {{ meta.label }}
        <span v-if="status === 'completed' && chunkCount">· {{ chunkCount }} 块</span>
      </span>
    </div>
  </div>
</template>
