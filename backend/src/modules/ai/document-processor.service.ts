import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { ChunkMetadata, FileType } from '../../common/types/common.types';
import { readFileSync, existsSync } from 'fs';
import { PDFParse } from 'pdf-parse';
import { marked } from 'marked';

// =============================================================================
// 文档加载器策略模式（ARCHITECTURE.md §3.1 类图、§5.3 T03 实现要点 4）
// =============================================================================

/** DocumentLoader 接口：每种文件格式实现 supports() + load() */
interface DocumentLoader {
  supports(fileType: FileType): boolean;
  load(filePath: string): Promise<string>;
}

/** PDF 加载器：使用 pdf-parse v2 API */
class PDFLoader implements DocumentLoader {
  supports(fileType: FileType): boolean {
    return fileType === FileType.PDF;
  }

  async load(filePath: string): Promise<string> {
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text;
  }
}

/** 纯文本加载器：原生文件读取 */
class TextLoader implements DocumentLoader {
  supports(fileType: FileType): boolean {
    return fileType === FileType.TXT;
  }

  async load(filePath: string): Promise<string> {
    return readFileSync(filePath, 'utf-8');
  }
}

/** Markdown 加载器：marked 解析后提取纯文本 */
class MarkdownLoader implements DocumentLoader {
  supports(fileType: FileType): boolean {
    return fileType === FileType.MARKDOWN;
  }

  async load(filePath: string): Promise<string> {
    const raw = readFileSync(filePath, 'utf-8');
    // 将 Markdown 解析为 HTML 然后提取纯文本（保留非 Markdown 的原始内容）
    const html = await marked.parse(raw, { async: true });
    return this.stripHtml(html);
  }

  private stripHtml(html: string): string {
    // 简单去除 HTML 标签，保留文本内容
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

// =============================================================================
// 文档处理流水线
// =============================================================================

/**
 * 文档处理服务（ARCHITECTURE.md §3.1 类图、§4.1 上传索引流程、§5.3 T03 实现要点 4）
 *
 * 4 阶段流水线：解析 → 分割 → 向量化 → 入库
 * - 解析：策略模式选择 DocumentLoader（PDF/TXT/Markdown）
 * - 分割：RecursiveCharacterTextSplitter（chunkSize=1000, chunkOverlap=200）
 * - 向量化：EmbeddingService.embedBatch
 * - 入库：VectorStoreService.addDocuments
 *
 * 每阶段通过 onStatusChange 回调通知调用方更新 MongoDB 文档状态。
 *
 * T03 阶段不直接依赖 Mongoose Document Model（属 T04），
 * 采用回调/事件机制解耦：调用方传入 onStatusChange(id, status, extra?) → 自行更新数据库。
 */
@Injectable()
export class DocumentProcessorService {
  private readonly logger = new Logger(DocumentProcessorService.name);
  private loaders: DocumentLoader[] = [];
  private splitter: RecursiveCharacterTextSplitter;

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService,
  ) {
    // 注册内置加载器
    this.registerLoader(new PDFLoader());
    this.registerLoader(new TextLoader());
    this.registerLoader(new MarkdownLoader());

    // 文本分割器：chunkSize=1000, chunkOverlap=200（§5.3 T03 实现要点 5）
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '。', '.', '！', '!', '？', '?', '；', ';', ' ', ''],
    });

    this.logger.log(`文档处理器初始化完成：${this.loaders.length} 种加载器已注册`);
  }

  /** 注册文档加载器（扩展新格式只需实现 DocumentLoader 并注册） */
  registerLoader(loader: DocumentLoader): void {
    this.loaders.push(loader);
  }

  /**
   * 处理文档入口
   * @param docId MongoDB 文档 ID
   * @param filePath 文件存储路径
   * @param fileType 文件类型
   * @param securityLevel 保密级别
   * @param department 所属部门
   * @param title 文档标题
   * @param onStatusChange 状态变更回调 (docId, status, extra?)
   */
  async processDocument(
    docId: string,
    filePath: string,
    fileType: FileType,
    securityLevel: string,
    department: string,
    title: string,
    onStatusChange: (docId: string, status: string, extra?: Record<string, unknown>) => Promise<void>,
  ): Promise<void> {
    try {
      // 阶段 1：解析
      this.logger.log(`[${docId}] 开始处理文档：${title}`);
      await onStatusChange(docId, 'parsing');

      const text = await this.parseFile(filePath, fileType);

      // 阶段 2：分割
      await onStatusChange(docId, 'embedding');

      const chunks = await this.chunkText(text, { documentId: docId, securityLevel, department, title, fileType });

      // 阶段 3：向量化
      this.logger.log(`[${docId}] 向量化 ${chunks.length} 个文本块`);
      const texts = chunks.map((c) => c.pageContent);
      const embeddings = await this.embeddingService.embedBatch(texts);

      // 阶段 4：入库
      const metadataArray: ChunkMetadata[] = chunks.map((c) => c.metadata);
      await this.vectorStoreService.addDocuments(chunks, embeddings, metadataArray);

      // 完成
      await onStatusChange(docId, 'completed', { chunkCount: chunks.length });
      this.logger.log(`[${docId}] 文档处理完成：${chunks.length} 个向量块已入库`);
    } catch (error) {
      this.logger.error(`[${docId}] 文档处理失败：${error}`);
      await onStatusChange(docId, 'failed', { errorMessage: String(error) });
      throw error;
    }
  }

  /** 选择合适的 DocumentLoader 解析文件 */
  private async parseFile(filePath: string, fileType: FileType): Promise<string> {
    if (!existsSync(filePath)) {
      throw new Error(`文件不存在：${filePath}`);
    }

    const loader = this.loaders.find((l) => l.supports(fileType));
    if (!loader) {
      throw new Error(`不支持的文件类型：${fileType}`);
    }

    this.logger.log(`使用 ${loader.constructor.name} 解析文件`);
    return loader.load(filePath);
  }

  /** 文本分割（输出 LangChain Document 数组） */
  private async chunkText(
    text: string,
    meta: { documentId: string; securityLevel: string; department: string; title: string; fileType: FileType },
  ): Promise<Array<{ pageContent: string; metadata: ChunkMetadata }>> {
    const docs = await this.splitter.createDocuments(
      [text],
      [], // no existing metadata
    );

    return docs.map((doc: Document, index: number) => ({
      pageContent: doc.pageContent,
      metadata: {
        documentId: meta.documentId,
        chunkIndex: index,
        securityLevel: meta.securityLevel as ChunkMetadata['securityLevel'],
        department: meta.department || 'all',
        title: meta.title,
        page: meta.fileType === FileType.PDF ? this.estimatePage(index) : 0,
      },
    }));
  }

  /** 估算 PDF 页码（简化：按 chunk 序号粗略估算，精确页码由 pdf-parse 原始实现提供时可用） */
  private estimatePage(chunkIndex: number): number {
    // T03 简化实现；T04 可通过 pdf-parse 逐页解析提供精确页码
    return Math.floor(chunkIndex / 5) + 1;
  }
}
