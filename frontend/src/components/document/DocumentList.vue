<script setup lang="ts">
import { onMounted, computed, ref, reactive } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { useAuthStore } from '@/stores/auth';
import { updateDocumentSecurity } from '@/api/document';
import DocumentProgress from './DocumentProgress.vue';
import { DEPARTMENTS, SECURITY_LEVEL_OPTIONS } from '@/constants';
import { SecurityLevel, type Document } from '@/types';
import { ReloadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';

const props = defineProps<{
  admin?: boolean;
}>();

const documentStore = useDocumentStore();
const authStore = useAuthStore();
const isAdmin = computed(() => props.admin ?? authStore.isAdmin);

const list = computed(() => documentStore.list);
const loading = computed(() => documentStore.loading);
const summaryLoading = ref<Record<string, boolean>>({});
const summaryCache = ref<Record<string, string>>({});

const summaryModal = reactive({
  visible: false,
  title: '',
  content: '',
  loading: false,
});

const securityModal = reactive({
  visible: false,
  docId: '',
  level: SecurityLevel.L1 as SecurityLevel,
  department: undefined as string | undefined,
});

async function refresh() {
  await documentStore.fetchList();
}

async function showSummary(doc: Document) {
  if (summaryCache.value[doc.id]) {
    summaryModal.title = doc.title;
    summaryModal.content = summaryCache.value[doc.id];
    summaryModal.visible = true;
    return;
  }
  summaryModal.title = doc.title;
  summaryModal.content = '';
  summaryModal.loading = true;
  summaryModal.visible = true;
  try {
    const result = await documentStore.fetchSummary(doc.id);
    summaryCache.value[doc.id] = result.summary;
    summaryModal.content = result.summary;
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '获取摘要失败');
    summaryModal.visible = false;
  } finally {
    summaryModal.loading = false;
  }
}

async function remove(doc: Document) {
  try {
    await documentStore.remove(doc.id);
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '删除失败');
  }
}

function openSecurityModal(doc: Document) {
  securityModal.docId = doc.id;
  securityModal.level = doc.securityLevel;
  securityModal.department = doc.department;
  securityModal.visible = true;
}

async function confirmSecurityChange() {
  const { docId, level, department } = securityModal;
  try {
    await updateDocumentSecurity(docId, { securityLevel: level, department: department || undefined });
    securityModal.visible = false;
    await refresh();
    message.success('保密级别已更新');
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '调整失败');
  }
}

const fileTypeColor: Record<string, string> = {
  pdf: 'red',
  txt: 'default',
  md: 'green',
  markdown: 'green',
};

const securityLevelColor: Record<string, string> = {
  L1: 'green',
  L2: 'blue',
  L3: 'orange',
  L4: 'red',
};

const levelOptions = SECURITY_LEVEL_OPTIONS.map((o) => ({ label: o.label, value: o.value }));
const deptOptions = DEPARTMENTS.map((d) => ({ label: d, value: d }));

onMounted(() => {
  void refresh();
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- 栏头 -->
    <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <FileTextOutlined class="text-slate-400" />
        文档库
        <span class="rounded-full bg-slate-100 px-1.5 text-[11px] font-medium text-slate-500">{{ list.length }}</span>
      </span>
      <a-button type="text" size="small" @click="refresh">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
    </div>

    <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
      <a-spin
        v-if="loading && !list.length"
        :spinning="true"
        style="display: flex; justify-content: center; padding: 16px;"
      />

      <!-- 空状态 -->
      <div
        v-else-if="!list.length"
        class="flex flex-col items-center justify-center px-4 py-12 text-center"
      >
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <FileTextOutlined style="font-size: 20px;" />
        </div>
        <p class="mt-3 text-sm text-slate-500">暂无文档</p>
        <p class="mt-1 text-xs text-slate-400">在管理后台上传文档以构建知识库</p>
      </div>

      <a-space v-else direction="vertical" :size="8" style="width: 100%;">
        <a-card
          v-for="doc in list"
          :key="doc.id"
          size="small"
          class="rounded-lg shadow-soft transition-shadow hover:shadow-card"
        >
          <!-- 文档信息行 -->
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-800">{{ doc.title }}</div>
              <div class="mt-1.5 flex flex-wrap items-center gap-1">
                <a-tag :color="fileTypeColor[doc.fileType] || 'default'" class="text-[10px] leading-[18px]">{{ doc.fileType }}</a-tag>
                <span class="text-[11px] text-slate-400">{{ (doc.fileSize / 1024).toFixed(1) }}KB</span>
                <a-tag :color="securityLevelColor[doc.securityLevel] || 'default'" class="text-[10px] leading-[18px]">{{ doc.securityLevel }}</a-tag>
                <span v-if="doc.department && doc.department !== 'all'" class="text-[11px] text-slate-400">{{ doc.department }}</span>
              </div>
            </div>
          </div>

          <!-- 索引进度 -->
          <div class="mt-2">
            <DocumentProgress :status="doc.status" :chunk-count="doc.chunkCount" />
          </div>

          <!-- 操作 -->
          <a-space :size="4" class="mt-2">
            <a-button
              type="link"
              size="small"
              :disabled="summaryLoading[doc.id] || doc.status !== 'completed'"
              @click="showSummary(doc)"
            >
              {{ summaryLoading[doc.id] ? '生成中…' : '摘要' }}
            </a-button>
            <template v-if="isAdmin">
              <a-button type="link" size="small" @click="openSecurityModal(doc)">调整级别</a-button>
              <a-popconfirm
                title="确定删除该文档？此操作将清除其向量索引。"
                ok-text="删除"
                cancel-text="取消"
                ok-type="danger"
                @confirm="remove(doc)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </template>
          </a-space>
        </a-card>
      </a-space>
    </div>

    <!-- 摘要弹窗 -->
    <a-modal
      v-model:open="summaryModal.visible"
      :title="summaryModal.title"
      :footer="null"
      width="520px"
    >
      <a-spin :spinning="summaryModal.loading">
        <p class="whitespace-pre-wrap text-sm leading-7 text-slate-600">{{ summaryModal.content || '暂无摘要内容' }}</p>
      </a-spin>
    </a-modal>

    <!-- 调整保密级别弹窗 -->
    <a-modal
      v-model:open="securityModal.visible"
      title="调整保密级别"
      ok-text="确认"
      cancel-text="取消"
      @ok="confirmSecurityChange"
    >
      <a-form layout="vertical">
        <a-form-item label="保密级别">
          <a-select v-model:value="securityModal.level" :options="levelOptions" style="width: 100%;" />
        </a-form-item>
        <a-form-item v-if="securityModal.level === SecurityLevel.L2 || securityModal.level === SecurityLevel.L3" label="所属部门">
          <a-select v-model:value="securityModal.department" :options="deptOptions" style="width: 100%;" placeholder="请选择部门" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
