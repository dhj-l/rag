import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatDeepSeek } from '@langchain/deepseek';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

/**
 * LLM 服务（ARCHITECTURE.md §1.4、§5.3 T03 实现要点 1）
 *
 * 封装 ChatDeepSeek（@langchain/deepseek），提供 chat / stream 两种调用方式。
 * Agent 主模型必须使用 deepseek-chat（支持 tool calling）；deepseek-reasoner 不支持工具调用。
 *
 * 优雅降级：API key 未配置时正常初始化（记 warning），T04 调用时才报明确错误。
 */
@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private model: ChatDeepSeek;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('llm.apiKey') ?? '';
    const modelName = this.configService.get<string>('llm.model', 'deepseek-chat');

    if (!apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY 未配置，LLM 服务不可用。生产环境请在 .env 中设置。');
      this.configured = false;
      // 仍创建空密钥实例，避免 DI 报错；API 调用时通过 isConfigured() 检查
      this.model = new ChatDeepSeek({
        apiKey: 'placeholder',
        model: modelName,
        temperature: 0,
      });
    } else {
      this.model = new ChatDeepSeek({
        apiKey,
        model: modelName,
        temperature: 0,
      });
      this.configured = true;
      this.logger.log(`LLM 服务初始化完成：${modelName} (temperature=0)`);
    }
  }

  /** 是否已配置 API key */
  isConfigured(): boolean {
    return this.configured;
  }

  /** 获取 ChatDeepSeek 实例，供 AgentService createAgent 使用 */
  getModel(): ChatDeepSeek {
    return this.model;
  }

  /**
   * 非流式对话
   * @param messages LangChain BaseMessage 数组
   * @returns 完整回复文本
   */
  async chat(messages: BaseMessage[]): Promise<string> {
    this.ensureConfigured();
    const result = await this.model.invoke(messages);
    const content = result.content;
    if (typeof content === 'string') {
      return content;
    }
    // 多模态或复杂 content blocks 场景：提取文本
    if (Array.isArray(content)) {
      return content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('');
    }
    return String(content);
  }

  /**
   * 流式对话
   * @param messages LangChain BaseMessage 数组
   * @param onToken 逐 token 回调
   * @returns 完整回复文本
   */
  async stream(messages: BaseMessage[], onToken: (token: string) => void): Promise<string> {
    this.ensureConfigured();
    const stream = await this.model.stream(messages);
    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.content;
      if (typeof content === 'string' && content) {
        fullContent += content;
        onToken(content);
      }
    }
    return fullContent;
  }

  /**
   * 便捷方法：用 HumanMessage 直接提问
   */
  async ask(systemPrompt: string, userQuery: string): Promise<string> {
    return this.chat([new SystemMessage(systemPrompt), new HumanMessage(userQuery)]);
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new Error('LLM 服务未配置：请设置 DEEPSEEK_API_KEY 环境变量');
    }
  }
}
