import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'langchain';
import * as z from 'zod';
import { PermissionService } from '../permission.service';
import { VectorStoreService } from '../vector-store.service';
import { LlmService } from '../llm.service';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { RagSearchOutput, SearchResult, UserContext } from '../../../common/types/common.types';

/**
 * RAG 检索工具（ARCHITECTURE.md §3.5 rag_search、§5.3 T03 实现要点 8）
 *
 * 执行流程：
 * 1. 从 config.context 获取权限上下文
 * 2. 调用 PermissionService.buildVectorFilter → VectorStoreService.similaritySearch（k=5）
 * 3. 无检索结果 → 返回 hasAnswer=false
 * 4. 有结果 → 拼接 prompt，调用 LlmService 流式生成答案
 * 5. 返回 { answer, sources, hasAnswer }
 */
@Injectable()
export class RagSearchTool {
  private readonly logger = new Logger(RagSearchTool.name);

  constructor(
    private readonly permissionService: PermissionService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly llmService: LlmService,
  ) {}

  create() {
    const self = this;
    return tool(
      async (input: { query: string }, config: any) => {
        const ctx = config?.context as UserContext | undefined;
        if (!ctx) {
          return JSON.stringify({
            answer: '权限上下文缺失，无法执行检索。',
            sources: [],
            hasAnswer: false,
          } as RagSearchOutput);
        }

        try {
          // 1. 构建权限过滤条件
          const filter = self.permissionService.buildVectorFilter(ctx);

          // 2. 向量检索
          const results: SearchResult[] = await self.vectorStoreService.similaritySearch(input.query, filter, 5);

          // 3. 无结果
          if (!results || results.length === 0) {
            return JSON.stringify({
              answer: '抱歉，文档中未提及相关内容。',
              sources: [],
              hasAnswer: false,
            } as RagSearchOutput);
          }

          // 4. 拼接 prompt 生成答案
          const contextText = results
            .map(
              (r, i) =>
                `[来源${i + 1}] 标题：${r.metadata?.title ?? '未知'} | 页码：${r.metadata?.page ?? 'N/A'}\n${r.pageContent}`,
            )
            .join('\n\n---\n\n');

          const systemPrompt = `你是一个知识库助手。请严格根据以下文档片段回答用户问题。
如果文档片段不足以回答，请如实说"文档中未提供足够信息"。
不要编造任何不在文档中的内容。

文档片段：
${contextText}`;

          const answer = await self.llmService.ask(systemPrompt, input.query);

          // 5. 构建来源引用
          const sources = results.map((r) => ({
            documentId: String(r.metadata?.documentId ?? ''),
            documentTitle: String(r.metadata?.title ?? '未知'),
            chunkContent: r.pageContent.slice(0, 200),
            chunkIndex: Number(r.metadata?.chunkIndex ?? 0),
            page: Number(r.metadata?.page ?? 0),
            securityLevel: (r.metadata?.securityLevel as any) ?? 'L1',
          }));

          return JSON.stringify({
            answer,
            sources,
            hasAnswer: true,
          } as RagSearchOutput);
        } catch (error) {
          self.logger.error(`RAG 检索失败：${error}`);
          return JSON.stringify({
            answer: `检索过程出错：${error}`,
            sources: [],
            hasAnswer: false,
          } as RagSearchOutput);
        }
      },
      {
        name: 'rag_search',
        description: '检索企业文档库，基于文档内容回答问题。适用于需要查找公司制度、流程、规范等文档信息的问题。',
        schema: z.object({
          query: z.string().describe('要检索的用户问题'),
        }),
      },
    );
  }
}
