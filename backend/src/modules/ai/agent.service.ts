import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  createAgent,
  summarizationMiddleware,
  dynamicSystemPromptMiddleware,
  modelRetryMiddleware,
  toolRetryMiddleware,
} from 'langchain';
import { HumanMessage, AIMessageChunk } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import * as z from 'zod';
import { LlmService } from './llm.service';
import { LangfuseService } from './langfuse.service';
import { RagSearchTool } from './tools/rag-search.tool';
import { SummarizeTool } from './tools/summarize.tool';
import { GeneralChatTool } from './tools/general-chat.tool';
import { UserContext, SSEEvent, SSEEventType, SourceReference } from '../../common/types/common.types';
import { Role } from '../../common/types/common.types';

/**
 * Agent 服务（ARCHITECTURE.md §1.3 Agent 架构、§5.3 T03 实现要点 6-8）
 *
 * 在 onModuleInit 中使用 langchain v1 createAgent 构建 Agent 实例：
 * - model: ChatDeepSeek（必须 deepseek-chat，因依赖工具调用）
 * - tools: rag_search / summarize_document / general_chat（通过 NestJS 注入的工具类创建）
 * - contextSchema: Zod 定义权限上下文 { role, departments, userId }
 * - middleware: dynamicSystemPrompt → summarization(4000 tokens) → modelRetry(3次) → toolRetry(2次)
 *
 * 调用方式：
 *   agent.stream({ messages: [...] }, {
 *     configurable: { thread_id: sessionId },
 *     context: { role, departments, userId },
 *   })
 */
@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private agent!: ReturnType<typeof createAgent>;

  constructor(
    private readonly llmService: LlmService,
    private readonly langfuseService: LangfuseService,
    private readonly ragSearchTool: RagSearchTool,
    private readonly summarizeTool: SummarizeTool,
    private readonly generalChatTool: GeneralChatTool,
  ) {}

  async onModuleInit(): Promise<void> {
    const contextSchema = z.object({
      role: z.enum(['employee', 'manager', 'ceo', 'admin']),
      departments: z.array(z.string()),
      userId: z.string(),
    });

    const callbacks = [];
    const langfuseHandler = this.langfuseService.getCallbackHandler();
    if (langfuseHandler) {
      callbacks.push(langfuseHandler);
    }

    this.agent = createAgent({
      model: this.llmService.getModel(),
      tools: [
        this.ragSearchTool.create(),
        this.summarizeTool.create(),
        this.generalChatTool.create(),
      ],
      contextSchema,
      systemPrompt: this.buildSystemPrompt(),
      middleware: [
        dynamicSystemPromptMiddleware<z.infer<typeof contextSchema>>((_state, runtime) => {
          const ctx = runtime.context as z.infer<typeof contextSchema>;
          return this.buildDynamicPrompt(ctx);
        }),
        summarizationMiddleware({
          model: this.llmService.getModel(),
          trigger: { tokens: 4000 },
        }),
        modelRetryMiddleware({ maxRetries: 3 }),
        toolRetryMiddleware({ maxRetries: 2 }),
      ],
    });

    this.logger.log('Agent 实例构建完成（deepseek-chat + 3 tools + 4 middleware）');
  }

  /**
   * 流式对话入口（§4.2 RAG 问答流程）
   *
   * @param sessionId 会话 ID（用于 thread_id 关联 tracing）
   * @param query 用户当前输入
   * @param user 权限上下文
   * @param history 多轮历史（§7.6，由 ChatService 从 MongoDB 加载最近 10 条）
   * @returns AsyncGenerator<SSEEvent>
   *
   * 说明：T03 createAgent 未配置 checkpointer，thread_id 不持久化；
   * 多轮上下文按 §7.6 由调用方显式传入 history，前置到当前 HumanMessage 之前。
   */
  async *streamChat(
    sessionId: string,
    query: string,
    user: UserContext,
    history: BaseMessage[] = [],
  ): AsyncGenerator<SSEEvent> {
    const input = {
      messages: [...history, new HumanMessage(query)],
    };

    const config = {
      configurable: { thread_id: sessionId },
      context: {
        role: user.role,
        departments: user.departments,
        userId: user.userId,
      },
    };

    let fullContent = '';
    const sources: SourceReference[] = [];

    try {
      // streamMode: ['values','messages'] —— values 用于工具/来源检测，
      // messages 用于逐 token 流式（v1 中 messages 模式自带 token 流，无需 streamTokens）
      const stream = await this.agent.stream(input, {
        ...config,
        streamMode: ['values', 'messages'],
      });

      for await (const chunk of stream) {
        // 多模式流产出 [mode, value] 元组
        const [mode, value] = chunk as [string, unknown];
        if (mode !== 'values' && mode !== 'messages') continue;

        if (mode === 'messages') {
          // messages 模式下 value 为 [AIMessageChunk, metadata]
          const [msg] = (value as [AIMessageChunk, unknown]) ?? [null];
          if (
            msg instanceof AIMessageChunk &&
            typeof msg.content === 'string' &&
            msg.content
          ) {
            fullContent += msg.content;
            yield { type: SSEEventType.TOKEN, content: msg.content };
          }
          continue;
        }

        // values 模式：完整状态快照
        const messages = (value as any)?.messages;
        if (!messages || !Array.isArray(messages)) continue;

        const lastMsg = messages[messages.length - 1];
        if (!lastMsg) continue;

        // 检测工具调用
        if (lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
          const toolName = lastMsg.tool_calls[0].name;
          yield { type: SSEEventType.TOOL, name: toolName };
          continue;
        }

        // 从工具结果中提取来源引用
        if (lastMsg.type === 'tool' && lastMsg.content) {
          try {
            const parsed =
              typeof lastMsg.content === 'string' ? JSON.parse(lastMsg.content) : lastMsg.content;
            if (parsed?.sources && Array.isArray(parsed.sources)) {
              sources.push(...parsed.sources);
            }
          } catch {
            // 非 JSON 忽略
          }
        }
      }

      // 推送来源和完成事件
      if (sources.length > 0) {
        yield { type: SSEEventType.SOURCES, data: sources };
      }
      yield { type: SSEEventType.DONE };

      this.logger.log(`[${sessionId}] 对话完成：${fullContent.length} 字符，${sources.length} 条来源`);
    } catch (error) {
      this.logger.error(`[${sessionId}] 流式对话失败：${error}`);
      yield { type: SSEEventType.ERROR, message: String(error) };
      yield { type: SSEEventType.DONE };
    }
  }

  /** 基础系统提示词（不含角色，由 dynamicSystemPromptMiddleware 动态注入角色信息） */
  private buildSystemPrompt(): string {
    return `你是一个智能文档助手，帮助用户检索和理解企业内部的文档知识。

你的职责：
1. 回答用户问题时，优先使用 rag_search 工具检索相关文档
2. 当用户要求总结某份文档内容时，使用 summarize_document 工具
3. 对于与文档无关的日常闲聊，使用 general_chat 工具

重要规则：
- 始终基于检索到的文档内容回答问题，不要编造信息
- 如果文档中没有找到相关内容，如实告知用户
- 回答时注明信息来源（文档标题）
- 使用中文回复`;
  }

  /** 按角色动态生成系统提示词补充（§1.3 中间件架构） */
  private buildDynamicPrompt(ctx: { role: string; departments: string[] }): string {
    const roleHints: Record<string, string> = {
      [Role.EMPLOYEE]: `当前用户角色：普通员工。只能访问 L1（公开）和 L2（部门内部）级别的文档。所属部门：${ctx.departments.join('、') || '无'}。`,
      [Role.MANAGER]: `当前用户角色：部门主管。可访问 L1-L3 级别的文档。所属部门：${ctx.departments.join('、') || '无'}。`,
      [Role.CEO]: `当前用户角色：CEO/高管。可访问 L1-L4 所有级别的文档，无部门限制。`,
      [Role.ADMIN]: `当前用户角色：管理员。可访问 L1-L4 所有级别的文档，无部门限制。`,
    };

    return roleHints[ctx.role] ?? '';
  }
}
