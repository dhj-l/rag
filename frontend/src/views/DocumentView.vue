<script setup lang="ts">
import DocumentUpload from '@/components/document/DocumentUpload.vue';
import DocumentList from '@/components/document/DocumentList.vue';
import { CloudUploadOutlined, FileTextOutlined } from '@ant-design/icons-vue';
</script>

<template>
  <div class="scrollbar-thin h-full overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
    <div class="mx-auto max-w-5xl">
      <!-- 页面头 -->
      <div class="mb-5">
        <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">文档管理</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">上传文档并管理知识库资源</p>
      </div>

      <!-- 两栏：左上传、右文档库 -->
      <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
        <!-- 上传 -->
        <div class="rounded-xl border border-slate-200/70 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div class="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <CloudUploadOutlined class="text-slate-400 dark:text-slate-500" />
            上传文档
          </div>
          <DocumentUpload compact />
        </div>

        <!-- 文档库 -->
        <div class="rounded-xl border border-slate-200/70 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <DocumentList admin />
        </div>
      </div>
    </div>
  </div>
</template>
