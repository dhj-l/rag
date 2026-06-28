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

const stageOrder = ['uploaded', 'parsing', 'embedding', 'completed'] as const;

const currentStep = computed(() => {
  if (props.status === 'failed') return -1;
  return stageOrder.indexOf(props.status as (typeof stageOrder)[number]);
});

const tagColor = computed(() => {
  const map: Record<string, string> = {
    uploaded: 'default',
    parsing: 'processing',
    embedding: 'processing',
    completed: 'success',
    failed: 'error',
  };
  return map[props.status] ?? 'default';
});
</script>

<template>
  <div>
    <div v-if="status === 'failed'" class="flex items-center gap-2">
      <a-tag :color="tagColor">{{ meta.label }}</a-tag>
      <span v-if="errorMessage" class="text-xs text-rose-600">{{ errorMessage }}</span>
    </div>

    <div v-else class="flex items-center gap-2">
      <a-steps :current="currentStep" size="small" style="flex: 1; min-width: 0;">
        <a-step v-for="(label, i) in ['已上传', '解析中', '向量化', '已完成']" :key="i" :title="label" />
      </a-steps>
      <a-tag :color="tagColor">
        {{ meta.label }}
        <template v-if="status === 'completed' && chunkCount"> · {{ chunkCount }} 块</template>
      </a-tag>
    </div>
  </div>
</template>
