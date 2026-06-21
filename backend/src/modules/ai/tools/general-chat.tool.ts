import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'langchain';
import * as z from 'zod';
import { LlmService } from '../llm.service';
import { GeneralChatOutput } from '../../../common/types/common.types';

/**
 * 通用闲聊工具（ARCHITECTURE.md §3.5 general_chat、§5.3 T03 实现要点 10）
 *
 * 执行流程：
 * 1. 直接调用 LlmService 进行通用对话
 * 2. 无权限过滤，无文档检索
 * 3. 作为兜底工具，处理与文档无关的日常闲聊
 *
 * Agent 在以下场景会选择此工具：
 * - 用户打招呼/闲聊
 * - rag_search 无法找到相关内容时
 * - 用户问题不涉及企业文档知识
 */
@Injectable()
export class GeneralChatTool {
  private readonly logger = new Logger(GeneralChatTool.name);

  constructor(private readonly llmService: LlmService) {}

  create() {
    const self = this;
    return tool(
      async (input: { query: string }) => {
        try {
          const systemPrompt =
            '你是一个友好的智能文档助手。请用简洁的中文回答用户的问题。你可以进行日常闲聊，也可以回答通用知识问题。';

          const response = await self.llmService.ask(systemPrompt, input.query);

          return JSON.stringify({
            response,
          } as GeneralChatOutput);
        } catch (error) {
          self.logger.error(`闲聊回复失败：${error}`);
          return JSON.stringify({
            response: `抱歉，我暂时无法回复。请稍后再试。`,
          } as GeneralChatOutput);
        }
      },
      {
        name: 'general_chat',
        description:
          '通用闲聊工具，用于处理与文档检索无关的日常对话、问候、通用知识问答。当用户的问题不涉及企业文档内容时使用此工具。',
        schema: z.object({
          query: z.string().describe('用户的闲聊或通用问题内容'),
        }),
      },
    );
  }
}
