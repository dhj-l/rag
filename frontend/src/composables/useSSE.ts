import { fetchEventSource } from '@microsoft/fetch-event-source';
import { ref, type Ref } from 'vue';
import type { SSEEvent } from '@/types';

/**
 * SSE 流式通信组合式函数（§1.6 / §4.4 / ADR-04）
 *
 * 基于 @microsoft/fetch-event-source 实现 POST + 自定义 Header
 * （原生 EventSource 不支持 POST/自定义头，无法携带 JWT）。
 *
 * 与 axios client 独立：手动从 localStorage 读取 token 注入 Authorization 头。
 */
export interface UseSSEOptions {
  /** 收到一条 SSE 事件（已 JSON 解析） */
  onEvent: (event: SSEEvent) => void;
  /** 连接异常或服务端错误 */
  onError?: (err: unknown) => void;
  /** 连接关闭（done / error / abort） */
  onClose?: () => void;
}

export interface UseSSEReturn {
  isStreaming: Ref<boolean>;
  /** 发起 SSE POST 请求 */
  stream: (url: string, body: unknown) => Promise<void>;
  /** 主动中断 */
  abort: () => void;
}

export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const isStreaming = ref(false);
  let controller: AbortController | null = null;

  async function stream(url: string, body: unknown): Promise<void> {
    const token = localStorage.getItem('da_token');
    controller = new AbortController();
    isStreaming.value = true;

    try {
      await fetchEventSource(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        // 关闭缓冲，确保逐 token 实时到达
        openWhenHidden: true,

        onopen: async (response) => {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            return;
          }
          if (response.status === 401) {
            // 手动处理 401（axios 拦截器不覆盖 fetch-event-source）
            localStorage.removeItem('da_token');
            localStorage.removeItem('da_user');
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            throw new Error('未登录或登录已过期');
          }
          throw new Error(`SSE 连接失败：${response.status}`);
        },

        onmessage: (ev) => {
          // fetch-event-source 默认 event 为空，数据在 data 字段
          if (!ev.data) return;
          try {
            const parsed = JSON.parse(ev.data) as SSEEvent;
            options.onEvent(parsed);
          } catch {
            // 非 JSON 数据忽略
          }
        },

        onerror: (err) => {
          if (options.onError) options.onError(err);
          // 抛出以终止重连（默认会无限重连）
          throw err;
        },

        onclose: () => {
          isStreaming.value = false;
          options.onClose?.();
        },
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        options.onError?.(err);
      }
    } finally {
      isStreaming.value = false;
      controller = null;
    }
  }

  function abort(): void {
    controller?.abort();
    isStreaming.value = false;
  }

  return { isStreaming, stream, abort };
}
