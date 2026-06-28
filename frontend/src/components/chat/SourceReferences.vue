<script setup lang="ts">
import { computed } from 'vue';
import type { SourceReference } from '@/types';
import { LinkOutlined } from '@ant-design/icons-vue';

const props = defineProps<{
  sources: SourceReference[];
}>();

const open = defineModel<boolean>('open', { default: false });

const activeKey = computed({
  get: () => (open.value ? ['sources'] : []),
  set: (val: (string | number)[]) => { open.value = val.length > 0; },
});

const securityColor: Record<string, string> = {
  L1: 'green',
  L2: 'blue',
  L3: 'orange',
  L4: 'red',
};
</script>

<template>
  <div class="mt-2">
    <a-collapse
      v-model:activeKey="activeKey"
      :bordered="false"
      style="background: transparent;"
    >
      <a-collapse-panel key="sources" :show-arrow="false">
        <template #header>
          <a-space :size="4" class="text-xs text-slate-500 dark:text-slate-400">
            <LinkOutlined />
            <span>来源：{{ sources.length }} 条引用</span>
          </a-space>
        </template>
        <a-space direction="vertical" :size="8" class="w-full">
          <a-card
            v-for="(src, i) in sources"
            :key="i"
            size="small"
            :bordered="false"
            class="rounded-lg bg-slate-50 transition-colors hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
          >
            <div class="mb-1.5 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ src.documentTitle }}</span>
              <a-tag :color="securityColor[src.securityLevel] || 'default'" class="text-[10px] leading-[18px]">
                {{ src.securityLevel }}
              </a-tag>
            </div>
            <p class="mb-1 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{{ src.chunkContent }}</p>
            <div class="text-[11px] text-slate-400 dark:text-slate-500">
              片段 #{{ src.chunkIndex }}<span v-if="src.page"> · 第 {{ src.page }} 页</span>
            </div>
          </a-card>
        </a-space>
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>
