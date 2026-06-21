import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AlibabaTongyiEmbeddings } from '@langchain/community/embeddings/alibaba_tongyi';

/**
 * Embedding 服务（ARCHITECTURE.md §1.4、§5.3 T03 实现要点 2）
 *
 * 封装 AlibabaTongyiEmbeddings（@langchain/community），通过阿里云 DashScope API
 * 调用通义千问 text-embedding-v3 模型（1024 维度）。
 *
 * 关键：AlibabaTongyiEmbeddings 默认读环境变量 ALIBABA_API_KEY，本服务手动传入
 * DASHSCOPE_API_KEY 作为 apiKey 参数覆盖。
 *
 * 优雅降级：API key 未配置时正常初始化，调用时抛明确错误。
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private model: AlibabaTongyiEmbeddings;
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('embedding.apiKey') ?? '';
    const modelName = this.configService.get<string>('embedding.model', 'text-embedding-v3');

    if (!apiKey) {
      this.logger.warn('DASHSCOPE_API_KEY 未配置，Embedding 服务不可用。生产环境请在 .env 中设置。');
      this.configured = false;
      this.model = new AlibabaTongyiEmbeddings({
        apiKey: 'placeholder',
        modelName: modelName as AlibabaTongyiEmbeddingsParams['modelName'],
      });
    } else {
      this.model = new AlibabaTongyiEmbeddings({
        apiKey,
        modelName: modelName as AlibabaTongyiEmbeddingsParams['modelName'],
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
  getEmbeddings(): AlibabaTongyiEmbeddings {
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
      throw new Error('Embedding 服务未配置：请设置 DASHSCOPE_API_KEY 环境变量');
    }
  }
}

/** AlibabaTongyiEmbeddings 支持的 modelName 类型（本地类型约束） */
type AlibabaTongyiEmbeddingsParams = {
  modelName: 'multimodal-embedding-v1' | 'text-embedding-v1' | 'text-embedding-v2' | 'text-embedding-v3' | 'text-embedding-v4';
};
