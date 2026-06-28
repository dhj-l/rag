<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { DEPARTMENTS, SECURITY_LEVEL_OPTIONS } from '@/constants';
import { SecurityLevel } from '@/types';
import { uploadRules, departmentValidator } from '@/config/form-rules';
import { InboxOutlined, CloudUploadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import type { FormInstance, UploadChangeParam } from 'ant-design-vue';

const props = defineProps<{
  compact?: boolean;
}>();

const emit = defineEmits<{
  uploaded: [documentId: string];
}>();

const documentStore = useDocumentStore();
const formRef = ref<FormInstance>();

const form = reactive({
  title: '',
  securityLevel: SecurityLevel.L1 as SecurityLevel,
  department: '',
});

const file = ref<File | null>(null);
const uploading = computed(() => documentStore.uploading);

const needDepartment = computed(
  () => form.securityLevel === SecurityLevel.L2 || form.securityLevel === SecurityLevel.L3,
);

const deptRules = computed(() => departmentValidator(form.securityLevel));

const ALLOWED_EXT = ['.pdf', '.txt', '.md', '.markdown'];

function beforeUpload(f: File) {
  const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    message.error('仅支持 pdf/txt/md/markdown 文件');
    return false;
  }
  if (f.size > 20 * 1024 * 1024) {
    message.error('文件大小不能超过 20MB');
    return false;
  }
  file.value = f;
  if (!form.title) form.title = f.name.replace(/\.[^.]+$/, '');
  return false;
}

function handleChange(info: UploadChangeParam) {
  if (info.fileList.length === 1 && !file.value) {
    beforeUpload(info.file as unknown as File);
  }
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  if (!file.value) {
    message.error('请选择文件');
    return;
  }

  try {
    const id = await documentStore.upload({
      file: file.value,
      title: form.title.trim(),
      securityLevel: form.securityLevel,
      department: needDepartment.value ? form.department : undefined,
    });
    emit('uploaded', id);
    file.value = null;
    form.title = '';
    form.securityLevel = SecurityLevel.L1;
    form.department = '';
    formRef.value?.resetFields();
    void documentStore.pollStatus(id);
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '上传失败');
  }
}
</script>

<template>
  <div :class="compact ? '' : 'rounded-lg border border-slate-200 bg-white p-4 shadow-soft'">
    <div
      v-if="!compact"
      class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"
    >
      <CloudUploadOutlined class="text-slate-400" />
      上传文档
    </div>

    <a-form
      ref="formRef"
      :model="form"
      :rules="uploadRules"
      layout="vertical"
      size="large"
    >
      <!-- 拖拽上传区域 -->
      <a-form-item style="margin-bottom: 16px;">
        <a-upload-dragger
          :max-count="1"
          :file-list="file ? [{ uid: '-1', name: file.name, size: file.size } as any] : []"
          :before-upload="beforeUpload"
          :show-upload-list="{ showPreviewIcon: false, showRemoveIcon: true, showDownloadIcon: false }"
          accept=".pdf,.txt,.md,.markdown"
          @change="handleChange"
          @remove="file = null"
        >
          <p class="ant-upload-drag-icon mb-2">
            <InboxOutlined class="text-brand-500" style="font-size: 36px;" />
          </p>
          <p class="ant-upload-text text-[13px] font-medium text-slate-600">点击或拖拽文件到此处上传</p>
          <p class="ant-upload-hint mt-1 text-xs text-slate-400">支持 PDF / TXT / Markdown（≤20MB）</p>
        </a-upload-dragger>
      </a-form-item>

      <a-form-item name="title" label="文档标题">
        <a-input v-model:value="form.title" placeholder="请输入文档标题" />
      </a-form-item>

      <a-form-item name="securityLevel" label="保密级别">
        <a-select v-model:value="form.securityLevel">
          <a-select-option v-for="opt in SECURITY_LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}（{{ opt.hint }}）
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="needDepartment" name="department" label="所属部门" :rules="deptRules">
        <a-select v-model:value="form.department" placeholder="请选择部门" allow-clear>
          <a-select-option v-for="d in DEPARTMENTS" :key="d" :value="d">{{ d }}</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>

    <a-button type="primary" :loading="uploading" block size="large" @click="submit">
      <template #icon><UploadOutlined /></template>
      {{ uploading ? '上传中…' : '上传' }}
    </a-button>
  </div>
</template>
