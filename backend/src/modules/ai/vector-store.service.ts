import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import type { Where } from 'chromadb';
import { EmbeddingService } from './embedding.service';
import { VectorFilter, TextChunk, ChunkMetadata, SearchResult, SecurityLevel } from '../../common/types/common.types';

/**
 * 向量库服务（ARCHITECTURE.md §1.4 Chroma 集成、§3.3 向量库 Metadata、§5.3 T03 实现要点 3）
 *
 * 对 LangChain Chroma 类的薄封装，核心职责：
 * - addDocuments：将文本块+向量+metadata 写入 Chroma collection
 * - similaritySearch：带权限过滤的语义检索（VectorFilter → Chroma where 语法）
 * - deleteByDocumentId：按文档 ID 清理向量（重新索引/删除文档用）
 *
 * Chroma filter 适配（§3.3 示例）：
 * - noRestriction=true → 不传 filter
 * - employee/manager → { $or: [{ securityLevel: "L1" }, { $and: [{ securityLevel: "L2" }, { department: { $in: [...] } }] }] }
 */
@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private store!: Chroma;
  private readonly collectionName = 'doc_assistant';

  constructor(
    private readonly configService: ConfigService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async onModuleInit(): Promise<void> {
    const chromaUrl = this.configService.get<string>('chroma.url', 'http://localhost:8000');
    const embeddings = this.embeddingService.getEmbeddings();

    this.store = new Chroma(embeddings, {
      collectionName: this.collectionName,
      url: chromaUrl,
      collectionMetadata: {
        'hnsw:space': 'cosine',
      },
    });

    this.logger.log(`向量库初始化完成：${chromaUrl} (collection: ${this.collectionName})`);
  }

  /**
   * 批量添加文档块到向量库
   * @param chunks 文本块数组
   * @param embeddings 对应向量（外层数组索引对应 chunks 索引）
   * @param metadata 每个 chunk 的 metadata
   */
  async addDocuments(chunks: TextChunk[], embeddings: number[][], metadata: ChunkMetadata[]): Promise<void> {
    const docs = chunks.map((chunk, i) => ({
      pageContent: chunk.pageContent,
      metadata: {
        documentId: metadata[i]?.documentId ?? chunk.metadata?.documentId,
        chunkIndex: metadata[i]?.chunkIndex ?? chunk.metadata?.chunkIndex ?? i,
        securityLevel: metadata[i]?.securityLevel ?? chunk.metadata?.securityLevel,
        department: metadata[i]?.department ?? chunk.metadata?.department ?? 'all',
        title: metadata[i]?.title ?? chunk.metadata?.title ?? '',
        page: metadata[i]?.page ?? chunk.metadata?.page ?? 0,
      },
    }));

    // Chroma.addDocuments 内部会调 embeddings.embedDocuments 重新生成向量
    await this.store.addDocuments(docs);
    this.logger.log(`已写入 ${docs.length} 个向量块`);
  }

  /**
   * 语义检索（带权限过滤）
   * @param query 查询文本
   * @param filter 权限过滤条件（由 PermissionService.buildVectorFilter 生成）
   * @param k 返回数量，默认 5
   * @returns 搜索结果列表
   */
  async similaritySearch(query: string, filter: VectorFilter, k: number = 5): Promise<SearchResult[]> {
    const where = this.buildChromaFilter(filter);

    const results = await this.store.similaritySearch(query, k, where);
    return results.map((doc) => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata as Record<string, unknown>,
    }));
  }

  /**
   * 按文档 ID 删除所有关联向量块
   * 用于文档删除或重新索引场景（§8.5）
   */
  async deleteByDocumentId(docId: string): Promise<void> {
    try {
      await this.store.delete({ filter: { documentId: docId } });
      this.logger.log(`已删除文档 ${docId} 的向量索引`);
    } catch (err) {
      this.logger.error(`删除向量索引失败 (docId=${docId})：${err}`);
      throw err;
    }
  }

  /**
   * 将 VectorFilter 转换为 Chroma where 语法（§3.3 Chroma 过滤条件示例）
   *
   * 两层过滤：
   * 1. 权限维度（保密级别 + 部门）：见下方 orClauses 构造。
   * 2. 会话关联文档维度（F-15）：若 filter.documentIds 非空，叠加
   *    `documentId IN documentIds`，将检索收窄到会话关联文档子空间。
   *
   * @example employee(信息技术部) → { $or: [
   *   { securityLevel: "L1" },
   *   { $and: [{ securityLevel: "L2" }, { department: { $in: ["信息技术部", "all"] } }] }
   * ]}
   * @example ceo → {}（空对象，等同于不传 filter）
   * @example employee + 关联文档 [d1,d2] → { $and: [
   *   { $or: [权限条件...] }, { documentId: { $in: ["d1","d2"] } }
   * ] }
   */
  private buildChromaFilter(filter: VectorFilter): Where | undefined {
    // F-15：会话关联文档限定子句
    const hasDocIdLimit = !!(filter.documentIds && filter.documentIds.length > 0);
    const docIdClause = hasDocIdLimit
      ? ({ documentId: { $in: filter.documentIds } } as unknown as Where)
      : undefined;

    // admin / ceo 无权限维度限制：仅当有关联文档时限定文档范围，否则全库
    if (filter.noRestriction) {
      return docIdClause;
    }

    const { accessibleLevels, departments } = filter;
    const l1Included = accessibleLevels.includes(SecurityLevel.L1);
    const deptLevels = accessibleLevels.filter((l) => l !== SecurityLevel.L1); // L2 / L3 / L4

    const orClauses: Where[] = [];

    if (l1Included) {
      orClauses.push({ securityLevel: SecurityLevel.L1 });
    }

    if (deptLevels.length > 0 && departments.length > 0) {
      orClauses.push({
        $and: [
          { securityLevel: { $in: deptLevels } } as unknown as Where,
          { department: { $in: [...departments, 'all'] } } as unknown as Where,
        ],
      });
    } else if (deptLevels.length > 0) {
      // 无部门信息时仅按级别过滤
      orClauses.push({ securityLevel: { $in: deptLevels } } as unknown as Where);
    }

    // 权限维度 where
    let permissionWhere: Where;
    if (orClauses.length === 0) {
      // 理论上不会发生，兜底返回永不命中条件
      permissionWhere = { securityLevel: '__none__' };
    } else if (orClauses.length === 1) {
      permissionWhere = orClauses[0];
    } else {
      permissionWhere = { $or: orClauses };
    }

    // F-15：叠加会话关联文档限定（权限条件 AND documentId IN [...]）
    if (docIdClause) {
      return { $and: [permissionWhere, docIdClause] } as unknown as Where;
    }
    return permissionWhere;
  }
}
