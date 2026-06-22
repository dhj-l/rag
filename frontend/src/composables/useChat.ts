import { ref, computed } from 'vue';
import { streamChat } from '@/api/chat';
import { useSessionStore } from '@/stores/session';
import { MessageRole, type Message, type SourceReference } from '@/types';

/** 工具名 → 前端展示文案（§4.4 tool 事件） */
const TOOL_HINTS: Record<string, string> = {
  rag_search: '正在检索文档…',
  summarize_document: '正在生成摘要…',
  general_chat: '思考中…',
};

/**
 * 对话逻辑组合式函数（§4.2 RAG 问答流程前端编排）
 *
 * 职责：
 * - 发送消息：乐观追加用户消息 + 流式累积助手回复
 * - token 逐字累积到 streamingContent；sources 注入；tool 事件更新状态提示
 * - done 后重新拉取会话详情，获取后端持久化的最终消息（含 sources/toolUsed）
 * - 暴露 isStreaming / streamingMessage / currentToolHint / abort / error
 *
 * 状态由 SSE 回调驱动，非轮询。
 */
export function useChat() {
  const sessionStore = useSessionStore();

  const isStreaming = ref(false);
  const streamingContent = ref('');
  const streamingSources = ref<SourceReference[]>([]);
  const currentToolHint = ref('');
  const error = ref('');
  let abortFn: (() => void) | null = null;

  /** 当前流式生成的助手消息（占位，渲染在已持久化消息之后） */
  const streamingMessage = computed<Message | null>(() => {
    if (!isStreaming.value) return null;
    return {
      id: '__streaming__',
      role: MessageRole.ASSISTANT,
      content: streamingContent.value,
      sources: streamingSources.value.length ? streamingSources.value : undefined,
      createdAt: new Date().toISOString(),
    };
  });

  /** 发送一条消息并启动流式接收（fire-and-forget，状态由回调更新） */
  function send(message: string): void {
    const content = message.trim();
    if (!content || isStreaming.value) return;

    const session = sessionStore.current;
    if (!session) {
      error.value = '未选择会话';
      return;
    }

    // 重置流式状态
    error.value = '';
    streamingContent.value = '';
    streamingSources.value = [];
    currentToolHint.value = '';
    isStreaming.value = true;

    // 乐观追加用户消息到当前会话（前端即时显示）
    const optimisticUser: Message = {
      id: `__local-${Date.now()}`,
      role: MessageRole.USER,
      content,
      createdAt: new Date().toISOString(),
    };
    session.messages = [...(session.messages ?? []), optimisticUser];

    const { abort } = streamChat(session.id, content, {
      onTool: (name) => {
        currentToolHint.value = TOOL_HINTS[name] ?? name;
      },
      onToken: (token) => {
        streamingContent.value += token;
        currentToolHint.value = '';
      },
      onSources: (sources) => {
        streamingSources.value = sources;
      },
      onError: (msg) => {
        error.value = msg;
        isStreaming.value = false;
        currentToolHint.value = '';
        abortFn = null;
      },
      onDone: () => {
        isStreaming.value = false;
        currentToolHint.value = '';
        abortFn = null;
        // 重新拉取会话详情，获取后端持久化的最终消息
        void sessionStore.select(session.id);
      },
    });
    abortFn = abort;
  }

  function abort(): void {
    abortFn?.();
    isStreaming.value = false;
    currentToolHint.value = '';
    abortFn = null;
  }

  return {
    isStreaming,
    streamingMessage,
    currentToolHint,
    error,
    send,
    abort,
  };
}
