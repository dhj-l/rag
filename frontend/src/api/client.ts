import axios from 'axios';
import type { ApiResponse } from '@/types';
import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

/**
 * Axios 实例（ARCHITECTURE.md T02 实现要点 7）
 *
 * - baseURL: /api（vite dev server proxy 到后端 3000）。
 * - 请求拦截器：从 localStorage 读 token，附加 Authorization: Bearer。
 * - 响应拦截器：业务 code !== 200 → reject {code, message}；401 → 自动登出回登录页。
 */
const client: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,

});

/** 请求拦截：自动附加 JWT */
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('da_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** 响应拦截：401 自动登出；成功时解包 data 字段 */
client.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // 解包统一响应 {code, data, message} → 仅返回 data
    const body = response.data;
    if (body && typeof body === 'object' && 'data' in body) {
      (response as AxiosResponse<unknown>).data = body.data;
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status ?? 0;
    const body = error.response?.data;
    if (status === 401) {
      localStorage.removeItem('da_token');
      localStorage.removeItem('da_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject({
      code: status,
      message: body?.message ?? '网络错误，请稍后重试',
    });
  },
);

export { client };
