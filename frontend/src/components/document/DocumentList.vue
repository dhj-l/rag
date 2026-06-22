<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { useAuthStore } from '@/stores/auth';
import { updateDocumentSecurity } from '@/api/document';
import DocumentProgress from './DocumentProgress.vue';
import { DEPARTMENTS, SECURITY_LEVEL_OPTIONS, DOCUMENT_STATUS_META } from '@/constants';
import { SecurityLevel, type Document } from '@/types';

const props = defineProps<{
  /** 管理员模式：显示删除 / 调整保密级别按钮 */
  admin?: boolean;
}>();

const documentStore = useDocumentStore();
const authStore = useAuthStore();
const isAdmin = computed(() => props.admin ?? authStore.isAdmin);

const list = computed(() => documentStore.list);
const loading = computed(() => documentStore.loading);
const summaryLoading = ref<Record<string, boolean>>({});
const summaryCache = ref<Record<string, string>>({});

async function refresh() {
  await documentStore.fetchList();
}

async function showSummary(doc: Document) {
  if (summaryCache.value[doc.id]) {
    alert(summaryCache.value[doc.id]);
    return;
  }
  summaryLoading.value[doc.id] = true;
  try {
    const result = await documentStore.fetchSummary(doc.id);
    summaryCache.value[doc.id] = result.summary;
    alert(`【${result.documentTitle}】\n\n${result.summary}`);
  } catch (err) {
    alert((err as { message?: string })?.message ?? '获取摘要失败');
  } finally {
    summaryLoading.value[doc.id] = false;
  }
}

async function remove(doc: Document) {
  if (!confirm(`确定删除文档「${doc.title}」？此操作将清除其向量索引。`)) return;
  try {
    await documentStore.remove(doc.id);
  } catch (err) {
    alert((err as { message?: string })?.message ?? '删除失败');
  }
}

const LEVEL_VALUES = SECURITY_LEVEL_OPTIONS.map((o) => o.value);

async function changeSecurity(doc: Document) {
  const opt = SECURITY_LEVEL_OPTIONS.map((o) => `${o.value} - ${o.label}`).join('\n');
  const levelInput = prompt(`选择新的保密级别：\n${opt}`, doc.securityLevel);
  if (!levelInput) return;
  const level = levelInput as SecurityLevel;
  if (!LEVEL_VALUES.includes(level)) return;
  let dept: string | undefined;
  if (level === SecurityLevel.L2 || level === SecurityLevel.L3) {
    dept = prompt(`请输入所属部门（${DEPARTMENTS.join('/')}）`, doc.department ?? '') ?? '';
    if (!dept) return;
  }
  try {
    await updateDocumentSecurity(doc.id, { securityLevel: level, department: dept ?? undefined });
    await refresh();
  } catch (err) {
    alert((err as { message?: string })?.message ?? '调整失败');
  }
}

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between px-3 py-2">
      <span class="text-sm font-semibold text-slate-700">文档库</span>
      <button class="text-xs text-brand-600 hover:underline" @click="refresh">刷新</button>
    </div>

    <div class="scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
      <div v-if="loading && !list.length" class="py-4 text-center text-xs text-slate-400">加载中…</div>
      <div v-else-if="!list.length" class="py-6 text-center text-xs text-slate-400">暂无文档</div>

      <div
        v-for="doc in list"
        :key="doc.id"
        class="rounded-lg border border-slate-200 bg-white p-2.5"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-slate-800">{{ doc.title }}</div>
            <div class="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <span class="rounded bg-slate-100 px-1 py-0.5">{{ doc.fileType }}</span>
              <span>{{ (doc.fileSize / 1024).toFixed(1) }}KB</span>
              <span
                class="rounded px-1 py-0.5"
                :class="(DOCUMENT_STATUS_META[doc.securityLevel]?.badge) || 'bg-slate-100 text-slate-600'"
              >{{ doc.securityLevel }}</span>
              <span v-if="doc.department && doc.department !== 'all'" class="text-slate-400">{{ doc.department }}</span>
            </div>
          </div>
        </div>

        <!-- 索引进度 -->
        <div class="mt-2">
          <DocumentProgress
            :status="doc.status"
            :chunk-count="doc.chunkCount"
            :error-message="undefined"
          />
        </div>

        <!-- 操作 -->
        <div class="mt-2 flex items-center gap-2 text-[11px]">
          <button
            class="text-brand-600 hover:underline disabled:opacity-50"
            :disabled="summaryLoading[doc.id] || doc.status !== 'completed'"
            @click="showSummary(doc)"
          >
            {{ summaryLoading[doc.id] ? '生成中…' : '摘要' }}
          </button>
          <template v-if="isAdmin">
            <button class="text-slate-500 hover:underline" @click="changeSecurity(doc)">调整级别</button>
            <button class="text-red-500 hover:underline" @click="remove(doc)">删除</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
