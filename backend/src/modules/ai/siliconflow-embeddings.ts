import { Embeddings, EmbeddingsParams } from '@langchain/core/embeddings';
import axios, { AxiosError } from 'axios';

interface SiliconFlowEmbeddingsParams extends EmbeddingsParams {
  apiKey?: string;
  model?: string; // 默认 'Qwen/Qwen3-Embedding-0.6B'
  apiUrl?: string; // 默认 'https://api.siliconflow.cn/v1/embeddings'
  dimensions?: number; // 仅 Qwen/Qwen3 系列支持，0.6B 可选 [64,128,256,512,768,1024]
  encodingFormat?: 'float' | 'base64'; // 默认 'float'
  timeout?: number; // 请求超时时间（毫秒），默认 30000
}

/**
 * 硅基流动（SiliconFlow）Embeddings（OpenAI 兼容接口）
 *
 * 继承 @langchain/core 的 Embeddings 抽象类，通过 axios 调用
 * https://api.siliconflow.cn/v1/embeddings，默认模型 Qwen/Qwen3-Embedding-0.6B（1024 维）。
 * 参考 langchain-test/src/core/siliconflow-embeddings.ts。
 */
export class SiliconFlowEmbeddings extends Embeddings {
  private apiKey: string;
  private model: string;
  private apiUrl: string;
  private dimensions?: number;
  private encodingFormat: 'float' | 'base64';
  private timeout: number;

  constructor(params: SiliconFlowEmbeddingsParams) {
    super(params);
    this.apiKey = params.apiKey || process.env.SILICONFLOW_API_KEY || '';
    this.model = params.model || 'Qwen/Qwen3-Embedding-0.6B';
    this.apiUrl = params.apiUrl || 'https://api.siliconflow.cn/v1/embeddings';
    this.dimensions = params.dimensions;
    this.encodingFormat = params.encodingFormat || 'float';
    this.timeout = params.timeout || 30000;
  }

  /**
   * 内部方法：调用 SiliconFlow API 批量生成文本向量
   * 利用接口 input 支持字符串数组的特性，单次请求处理多段文本
   */
  private async embedTexts(texts: string[]): Promise<number[][]> {
    try {
      const body: Record<string, unknown> = {
        model: this.model,
        input: texts,
      };
      if (this.dimensions !== undefined) {
        body.dimensions = this.dimensions;
      }
      if (this.encodingFormat !== 'float') {
        body.encoding_format = this.encodingFormat;
      }

      const response = await axios.post(this.apiUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: this.timeout,
      });

      // 响应格式为 OpenAI 兼容：data.data[].embedding
      const data = response.data?.data;
      if (!Array.isArray(data) || data.length !== texts.length) {
        throw new Error('Invalid response format from SiliconFlow API');
      }

      // base64 编码时需要解码，这里仅处理 float（默认）
      const embeddings = data.map((item: { embedding?: unknown }) => {
        const embedding = item.embedding;
        if (!Array.isArray(embedding)) {
          throw new Error('Invalid embedding format in SiliconFlow response');
        }
        return embedding as number[];
      });

      return embeddings;
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(
          `SiliconFlow API request failed: ${error.message} (status: ${error.response?.status})`,
        );
      }
      throw error;
    }
  }

  /**
   * 为单个查询文本生成向量
   * 实现 LangChain Embeddings 接口的 embedQuery 方法
   */
  async embedQuery(text: string): Promise<number[]> {
    const [embedding] = await this.embedTexts([text]);
    return embedding;
  }

  /**
   * 为多个文档文本生成向量
   * 实现 LangChain Embeddings 接口的 embedDocuments 方法
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embedTexts(texts);
  }
}
