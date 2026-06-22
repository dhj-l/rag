import { useSSE, type UseSSEOptions } from '@/composables/useSSE';
import type { SSEEvent, SourceReference } from '@/types';

/** 对话 SSE 事件回调集合 */
export interface ChatStreamHandlers {
  onToken?: (content: string) => void;
  onSources?: (sources: SourceReference[]) => void;
  onTool?: (name: string) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

/**
 * 对话 API（§3.6 POST /api/sessions/:id/chat，SSE 流式）
 *
 * 封装 useSSE，将五种 SSE 事件分发为细粒度回调。
 * 返回 { isStreaming, abort } 供 useChat 控制流。
 */
export function streamChat(
  sessionId: string,
  message: string,
  handlers: ChatStreamHandlers,
): { isStreaming: ReturnType<typeof useSSE>['isStreaming']; abort: () => void } {
  const sseOptions: UseSSEOptions = {
    onEvent: (evt: SSEEvent) => {
      switch (evt.type) {
        case 'token':
          if (evt.content) handlers.onToken?.(evt.content);
          break;
        case 'sources':
          if (evt.data) handlers.onSources?.(evt.data);
          break;
        case 'tool':
          if (evt.name) handlers.onTool?.(evt.name);
          break;
        case 'error':
          handlers.onError?.(evt.message ?? '对话出错');
          break;
        case 'done':
          handlers.onDone?.();
          break;
      }
    },
    onError: (err) => handlers.onError?.(String(err)),
  };

  const { isStreaming, stream, abort } = useSSE(sseOptions);
  void stream(`/api/sessions/${sessionId}/chat`, { message });
  return { isStreaming, abort };
}
