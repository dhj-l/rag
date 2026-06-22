import { client } from './client';
import type { ApiResponse, Document, DocumentStatus, SecurityLevel } from '@/types';

interface DocumentListResult {
  list: Document[];
  total: number;
}

interface UploadDocumentResult {
  documentId: string;
  status: string;
}

interface DocumentStatusResult {
  documentId: string;
  status: DocumentStatus;
  chunkCount?: number;
  errorMessage?: string;
}

interface DocumentSummaryResult {
  summary: string;
  documentTitle: string;
}

interface UploadDocumentInput {
  file: File;
  title: string;
  securityLevel: SecurityLevel;
  department?: string;
}

/** POST /api/documents/upload（admin，multipart） */
export async function uploadDocument(input: UploadDocumentInput): Promise<UploadDocumentResult> {
  const form = new FormData();
  form.append('file', input.file);
  form.append('title', input.title);
  form.append('securityLevel', input.securityLevel);
  if (input.department) form.append('department', input.department);
  const { data } = await client.post<ApiResponse<UploadDocumentResult>, { data: UploadDocumentResult }>(
    '/documents/upload',
    form,
  );
  return data;
}

/** GET /api/documents（权限过滤） */
export async function listDocuments(
  params: { page?: number; pageSize?: number } = {},
): Promise<DocumentListResult> {
  const { data } = await client.get<ApiResponse<DocumentListResult>, { data: DocumentListResult }>(
    '/documents',
    { params },
  );
  return data;
}

/** GET /api/documents/:id/status */
export async function getDocumentStatus(id: string): Promise<DocumentStatusResult> {
  const { data } = await client.get<ApiResponse<DocumentStatusResult>, { data: DocumentStatusResult }>(
    `/documents/${id}/status`,
  );
  return data;
}

/** GET /api/documents/:id/summary */
export async function getDocumentSummary(id: string): Promise<DocumentSummaryResult> {
  const { data } = await client.get<ApiResponse<DocumentSummaryResult>, { data: DocumentSummaryResult }>(
    `/documents/${id}/summary`,
  );
  return data;
}

/** DELETE /api/documents/:id（admin） */
export async function deleteDocument(id: string): Promise<void> {
  await client.delete(`/documents/${id}`);
}

/** PATCH /api/documents/:id（admin，调整保密级别/部门并重索引，§8.5） */
export async function updateDocumentSecurity(
  id: string,
  payload: { securityLevel: SecurityLevel; department?: string },
): Promise<Document> {
  const { data } = await client.patch<ApiResponse<Document>, { data: Document }>(
    `/documents/${id}`,
    payload,
  );
  return data;
}
