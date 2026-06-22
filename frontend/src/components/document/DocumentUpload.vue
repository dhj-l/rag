<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { DEPARTMENTS, SECURITY_LEVEL_OPTIONS } from '@/constants';
import { SecurityLevel } from '@/types';

const props = defineProps<{
  /** 管理后台上传后是否在 ChatView 右栏也展示 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  uploaded: [documentId: string];
}>();

const documentStore = useDocumentStore();

const file = ref<File | null>(null);
const title = ref('');
const securityLevel = ref<SecurityLevel>(SecurityLevel.L1);
const department = ref('');
const dragOver = ref(false);
const uploading = computed(() => documentStore.uploading);
const errorMsg = ref('');

const needDepartment = computed(
  () => securityLevel.value === SecurityLevel.L2 || securityLevel.value === SecurityLevel.L3,
);

const ALLOWED_EXT = ['.pdf', '.txt', '.md', '.markdown'];

function pickFile(f: File | null | undefined) {
  errorMsg.value = '';
  if (!f) return;
  const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    errorMsg.value = '仅支持 pdf/txt/md/markdown 文件';
    return;
  }
  if (f.size > 20 * 1024 * 1024) {
    errorMsg.value = '文件大小不能超过 20MB';
    return;
  }
  file.value = f;
  if (!title.value) title.value = f.name.replace(/\.[^.]+$/, '');
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  pickFile(e.dataTransfer?.files?.[0]);
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  pickFile(input.files?.[0]);
}

async function submit() {
  if (!file.value) {
    errorMsg.value = '请选择文件';
    return;
  }
  if (!title.value.trim()) {
    errorMsg.value = '请填写文档标题';
    return;
  }
  if (needDepartment.value && !department.value) {
    errorMsg.value = '请选择所属部门';
    return;
  }

  errorMsg.value = '';
  try {
    const id = await documentStore.upload({
      file: file.value,
      title: title.value.trim(),
      securityLevel: securityLevel.value,
      department: needDepartment.value ? department.value : undefined,
    });
    emit('uploaded', id);
    // 重置表单
    file.value = null;
    title.value = '';
    securityLevel.value = SecurityLevel.L1;
    department.value = '';
    // 后台轮询状态
    void documentStore.pollStatus(id);
  } catch (err) {
    errorMsg.value = (err as { message?: string })?.message ?? '上传失败';
  }
}
</script>

<template>
  <div :class="compact ? '' : 'rounded-lg border border-slate-200 bg-white p-4'">
    <div v-if="!compact" class="mb-3 text-sm font-semibold text-slate-700">上传文档</div>

    <!-- 拖拽区 -->
    <div
      class="mb-3 rounded-lg border-2 border-dashed p-4 text-center transition-colors"
      :class="dragOver ? 'border-brand-400 bg-brand-50' : 'border-slate-300'"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <input
        id="doc-upload-file"
        type="file"
        accept=".pdf,.txt,.md,.markdown"
        class="hidden"
        @change="onFileChange"
      />
      <label
        for="doc-upload-file"
        class="block cursor-pointer text-xs text-slate-500"
      >
        <div class="mb-1 text-2xl">📄</div>
        <div v-if="file" class="text-brand-600">{{ file.name }}（{{ (file.size / 1024).toFixed(1) }} KB）</div>
        <div v-else>点击或拖拽文件到此处上传<br />支持 PDF / TXT / Markdown（≤20MB）</div>
        <span class="mt-1 inline-block rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">选择文件</span>
      </label>
    </div>

    <div class="space-y-2.5">
      <div>
        <label class="mb-1 block text-xs text-slate-600">文档标题</label>
        <input
          v-model="title"
          class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          placeholder="请输入文档标题"
        />
      </div>

      <div>
        <label class="mb-1 block text-xs text-slate-600">保密级别</label>
        <select
          v-model="securityLevel"
          class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option v-for="opt in SECURITY_LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}（{{ opt.hint }}）
          </option>
        </select>
      </div>

      <div v-if="needDepartment">
        <label class="mb-1 block text-xs text-slate-600">所属部门</label>
        <select
          v-model="department"
          class="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">请选择部门</option>
          <option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</option>
        </select>
      </div>
    </div>

    <div v-if="errorMsg" class="mt-2 text-xs text-red-500">{{ errorMsg }}</div>

    <button
      :disabled="uploading"
      class="mt-3 w-full rounded-md bg-brand py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      @click="submit"
    >
      {{ uploading ? '上传中…' : '上传' }}
    </button>
  </div>
</template>
