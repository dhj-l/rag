import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  uploadDocument as apiUploadDocument,
  listDocuments as apiListDocuments,
  getDocumentStatus as apiGetDocumentStatus,
  getDocumentSummary as apiGetDocumentSummary,
  deleteDocument as apiDeleteDocument,
} from '@/api/document';
import type { Document, DocumentStatus, SecurityLevel } from '@/types';

/**
 * 文档 Store（T04）
 *
 * 管理文档列表、上传状态、索引状态轮询缓存。
 * 聊天/文档页面（T05）基于此 Store 渲染。
 */
export const useDocumentStore = defineStore('document', () => {
  const list = ref<Document[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const uploading = ref(false);
  /** 文档 ID → 索引状态缓存，供轮询复用 */
  const statusMap = ref<Record<string, DocumentStatus>>({});

  async function fetchList(params?: { page?: number; pageSize?: number }): Promise<void> {
    loading.value = true;
    try {
      const result = await apiListDocuments(params);
      list.value = result.list;
      total.value = result.total;
    } finally {
      loading.value = false;
    }
  }

  async function upload(input: {
    file: File;
    title: string;
    securityLevel: SecurityLevel;
    department?: string;
  }): Promise<string> {
    uploading.value = true;
    try {
      const result = await apiUploadDocument(input);
      statusMap.value[result.documentId] = 'uploaded' as DocumentStatus;
      return result.documentId;
    } finally {
      uploading.value = false;
    }
  }

  /** 轮询索引状态；完成或失败时刷新列表 */
  async function pollStatus(documentId: string, intervalMs = 2000): Promise<DocumentStatus> {
    const stop = async () => {
      const status = await apiGetDocumentStatus(documentId);
      statusMap.value[documentId] = status.status;
      if (status.status === 'completed' || status.status === 'failed') {
        await fetchList();
        return status.status;
      }
      return null;
    };

    const first = await stop();
    if (first) return first;

    return new Promise<DocumentStatus>((resolve) => {
      const timer = setInterval(async () => {
        const result = await stop();
        if (result) {
          clearInterval(timer);
          resolve(result);
        }
      }, intervalMs);
    });
  }

  async function fetchSummary(id: string): Promise<{ summary: string; documentTitle: string }> {
    return apiGetDocumentSummary(id);
  }

  async function remove(id: string): Promise<void> {
    await apiDeleteDocument(id);
    await fetchList();
  }

  return { list, total, loading, uploading, statusMap, fetchList, upload, pollStatus, fetchSummary, remove };
});
