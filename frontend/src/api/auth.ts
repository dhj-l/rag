import { client } from './client';
import type { ApiResponse } from '@/types';

interface LoginData {
  token: string;
  user: { id: string; username: string; displayName: string; role: string; departments: string[] };
}

interface ProfileData {
  userId: string;
  username: string;
  role: string;
  departments: string[];
}

/** POST /api/auth/login（§3.6） */
export async function login(username: string, password: string): Promise<LoginData> {
  const { data } = await client.post<ApiResponse<LoginData>, { data: LoginData }>(
    '/auth/login',
    { username, password },
  );
  return data;
}

/** GET /api/auth/profile（§3.6） */
export async function getProfile(): Promise<ProfileData> {
  const { data } = await client.get<ApiResponse<ProfileData>, { data: ProfileData }>('/auth/profile');
  return data;
}
