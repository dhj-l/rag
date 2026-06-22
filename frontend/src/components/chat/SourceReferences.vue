<script setup lang="ts">
import type { SourceReference } from '@/types';

const props = defineProps<{
  sources: SourceReference[];
}>();

const open = defineModel<boolean>('open', { default: false });

const securityBadge: Record<string, string> = {
  L1: 'bg-green-100 text-green-700',
  L2: 'bg-blue-100 text-blue-700',
  L3: 'bg-amber-100 text-amber-700',
  L4: 'bg-red-100 text-red-700',
};
</script>

<template>
  <div class="mt-2 border-t border-slate-100 pt-2">
    <button
      class="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand-600"
      @click="open = !open"
    >
      <span>📎 来源：{{ sources.length }} 条引用</span>
      <span class="transition-transform" :class="open ? 'rotate-90' : ''">›</span>
    </button>

    <div v-if="open" class="mt-2 space-y-2">
      <div
        v-for="(src, i) in sources"
        :key="i"
        class="rounded-md bg-slate-50 p-2.5 text-xs"
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="font-medium text-slate-700">{{ src.documentTitle }}</span>
          <span
            class="rounded px-1.5 py-0.5 text-[10px] font-medium"
            :class="securityBadge[src.securityLevel] || 'bg-slate-100 text-slate-600'"
          >
            {{ src.securityLevel }}
          </span>
        </div>
        <p class="line-clamp-3 text-slate-500">{{ src.chunkContent }}</p>
        <div class="mt-1 text-[10px] text-slate-400">
          片段 #{{ src.chunkIndex }}<span v-if="src.page"> · 第 {{ src.page }} 页</span>
        </div>
      </div>
    </div>
  </div>
</template>
