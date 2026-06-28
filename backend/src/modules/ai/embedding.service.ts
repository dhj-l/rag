import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SiliconFlowEmbeddings } from './siliconflow-embeddings';

/**
 * Embedding 服务（ARCHITECTURE.md §1.4、§5.3 T03 实现要点 2）
 *
 * 封装 SiliconFlowEmbeddings，通过硅基流动（SiliconFlow）OpenAI 兼容接口
 * 调用通义千问 Qwen/Qwen3-Embedding-0.6B 模型（默认 1024 维度）。
 *
 * 优雅降级：API key 未配置时正常初始化，调用时抛明确错误。
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private model: SiliconFlowEmbeddings;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('embedding.apiKey') ?? '';
    const modelName = this.configService.get<string>('embedding.model', 'Qwen/Qwen3-Embedding-0.6B');
    const baseUrl = this.configService.get<string>('embedding.baseUrl', 'https://api.siliconflow.cn/v1');
    const apiUrl = `${baseUrl.replace(/\/$/, '')}/embeddings`;

    if (!apiKey) {
      this.logger.warn('SILICONFLOW_API_KEY 未配置，Embedding 服务不可用。生产环境请在 .env 中设置。');
      this.configured = false;
      this.model = new SiliconFlowEmbeddings({
        apiKey: 'placeholder',
        model: modelName,
        apiUrl,
      });
    } else {
      this.model = new SiliconFlowEmbeddings({
        apiKey,
        model: modelName,
        apiUrl,
      });
      this.configured = true;
      this.logger.log(`Embedding 服务初始化完成：${modelName}`);
    }
  }

  /** 是否已配置 API key */
  isConfigured(): boolean {
    return this.configured;
  }

  /** 获取底层 embeddings 实例，供 Chroma 等 LangChain 集成使用 */
  getEmbeddings(): SiliconFlowEmbeddings {
    return this.model;
  }

  /**
   * 单条文本向量化
   * @returns 1024 维向量
   */
  async embedText(text: string): Promise<number[]> {
    this.ensureConfigured();
    return this.model.embedQuery(text);
  }

  /**
   * 批量文本向量化
   * @returns 二维数组 [文本数][1024]
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    this.ensureConfigured();
    return this.model.embedDocuments(texts);
  }

  private ensureConfigured(): void {
    if (!this.configured) {
      throw new Error('Embedding 服务未配置：请设置 SILICONFLOW_API_KEY 环境变量');
    }
  }
}
