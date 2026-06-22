import { client } from './client';
import type { ApiResponse, Session, SessionDetail } from '@/types';

interface SessionListResult {
  list: Session[];
  total: number;
}

/** POST /api/sessions */
export async function createSession(title?: string): Promise<Session> {
  const { data } = await client.post<ApiResponse<Session>, { data: Session }>('/sessions', title ? { title } : {});
  return data;
}

/** GET /api/sessions（仅本人） */
export async function listSessions(
  params: { page?: number; pageSize?: number } = {},
): Promise<SessionListResult> {
  const { data } = await client.get<ApiResponse<SessionListResult>, { data: SessionListResult }>(
    '/sessions',
    { params },
  );
  return data;
}

/** GET /api/sessions/:id（含消息历史） */
export async function getSession(id: string): Promise<SessionDetail> {
  const { data } = await client.get<ApiResponse<SessionDetail>, { data: SessionDetail }>(`/sessions/${id}`);
  return data;
}

/** PATCH /api/sessions/:id（重命名） */
export async function renameSession(id: string, title: string): Promise<Session> {
  const { data } = await client.patch<ApiResponse<Session>, { data: Session }>(`/sessions/${id}`, { title });
  return data;
}

/** DELETE /api/sessions/:id */
export async function deleteSession(id: string): Promise<void> {
  await client.delete(`/sessions/${id}`);
}
