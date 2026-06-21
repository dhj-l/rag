import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CallbackHandler } from 'langfuse-langchain';

/**
 * Langfuse 追踪服务（ARCHITECTURE.md §1.5、§5.3 T03 实现要点 9）
 *
 * 初始化 Langfuse CallbackHandler，供 AgentService 注入到 createAgent 的 callbacks 中。
 *
 * 优雅降级：LANGFUSE_PUBLIC_KEY 未配置时，isEnabled() 返回 false，
 * AgentService 不附加 callbacks，功能正常但无追踪数据。
 */
@Injectable()
export class LangfuseService {
  private readonly logger = new Logger(LangfuseService.name);
  private handler: CallbackHandler | null = null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const publicKey = this.configService.get<string>('langfuse.publicKey');
    const secretKey = this.configService.get<string>('langfuse.secretKey');
    const baseUrl = this.configService.get<string>('langfuse.baseUrl', 'http://localhost:3001');

    if (publicKey && secretKey) {
      this.handler = new CallbackHandler({
        publicKey,
        secretKey,
        baseUrl,
      });
      this.enabled = true;
      this.logger.log(`Langfuse 追踪已启用：${baseUrl}`);
    } else {
      this.enabled = false;
      this.logger.warn('Langfuse 未配置（LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY 为空），追踪功能已禁用');
    }
  }

  /** 获取 CallbackHandler 实例（未启用时返回 null） */
  getCallbackHandler(): CallbackHandler | null {
    return this.handler;
  }

  /** 是否已启用 Langfuse 追踪 */
  isEnabled(): boolean {
    return this.enabled;
  }
}
