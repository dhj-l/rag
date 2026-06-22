import { client } from './client';
import type { ApiResponse } from '@/types';

export interface UserResponse {
  id: string;
  username: string;
  displayName: string;
  role: string;
  departments: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UserListResult {
  list: UserResponse[];
  total: number;
}

interface CreateUserInput {
  username: string;
  password: string;
  displayName: string;
  role: string;
  departments: string[];
}

interface UpdateUserInput {
  role?: string;
  departments?: string[];
}

/** GET /api/users（admin） */
export async function listUsers(params: { page?: number; pageSize?: number } = {}): Promise<UserListResult> {
  const { data } = await client.get<ApiResponse<UserListResult>, { data: UserListResult }>('/users', { params });
  return data;
}

/** POST /api/users（admin） */
export async function createUser(input: CreateUserInput): Promise<UserResponse> {
  const { data } = await client.post<ApiResponse<UserResponse>, { data: UserResponse }>('/users', input);
  return data;
}

/** PATCH /api/users/:id（admin，改角色/部门） */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserResponse> {
  const { data } = await client.patch<ApiResponse<UserResponse>, { data: UserResponse }>(`/users/${id}`, input);
  return data;
}

/** PATCH /api/users/:id/status（admin，启停） */
export async function updateUserStatus(id: string, status: 'active' | 'disabled'): Promise<UserResponse> {
  const { data } = await client.patch<ApiResponse<UserResponse>, { data: UserResponse }>(`/users/${id}/status`, { status });
  return data;
}
