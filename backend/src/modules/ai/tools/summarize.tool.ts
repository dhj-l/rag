import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'langchain';
import * as z from 'zod';
import { PermissionService } from '../permission.service';
import { LlmService } from '../llm.service';
import { DocumentProcessorService } from '../document-processor.service';
import { SummarizeOutput, UserContext, FileType } from '../../../common/types/common.types';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';

/**
 * 文档摘要工具（ARCHITECTURE.md §3.5 summarize_document、§5.3 T03 实现要点 9）
 *
 * 执行流程：
 * 1. 从 config.context 获取权限上下文
 * 2. 从 MongoDB 查询文档信息（raw collection）
 * 3. 调 PermissionService.canAccessDocument 校验权限
 * 4. 无权限返回提示
 * 5. 有权限读文件内容（F-07：复用 DocumentProcessorService.extractText 正确解析 PDF），
 *    调 LlmService 生成摘要
 * 6. 返回 { summary, documentTitle }
 */
@Injectable()
export class SummarizeTool {
  private readonly logger = new Logger(SummarizeTool.name);

  constructor(
    private readonly permissionService: PermissionService,
    private readonly llmService: LlmService,
    // F-07：注入 DocumentProcessorService 以复用统一文件解析（避免直接 readFileSync PDF 乱码）
    private readonly documentProcessorService: DocumentProcessorService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  create() {
    const self = this;
    return tool(
      async (input: { documentId: string }, config: any) => {
        const ctx = config?.context as UserContext | undefined;
        if (!ctx) {
          return JSON.stringify({
            summary: '权限上下文缺失，无法执行摘要。',
            documentTitle: '',
          } as SummarizeOutput);
        }

        try {
          // 1. 查询文档信息（raw collection 'documents'，字段名与 §3.2 schema 保持一致）
          const doc = await self.connection
            .collection('documents')
            .findOne({ _id: new Types.ObjectId(input.documentId) });

          if (!doc) {
            return JSON.stringify({
              summary: '文档不存在或已被删除。',
              documentTitle: '',
            } as SummarizeOutput);
          }

          // 2. 权限校验
          const hasAccess = self.permissionService.canAccessDocument(ctx as any, {
            id: doc._id.toString(),
            title: doc.title,
            filename: doc.filename,
            fileType: doc.fileType,
            fileSize: doc.fileSize,
            securityLevel: doc.securityLevel,
            department: doc.department ?? 'all',
            status: doc.status,
          });

          if (!hasAccess) {
            return JSON.stringify({
              summary: '您没有权限查看该文档的摘要。',
              documentTitle: doc.title,
            } as SummarizeOutput);
          }

          // 3. 读文件内容
          //    F-07 修复：复用 DocumentProcessorService.extractText，PDF 走 pdf-parse 正确解析，
          //    替代早期 require('fs') + readFileSync(utf-8) 读 PDF 二进制导致的乱码。
          if (!doc.filePath) {
            return JSON.stringify({
              summary: '文档文件不可用。',
              documentTitle: doc.title,
            } as SummarizeOutput);
          }

          let fileContent = '';
          try {
            const content = await self.documentProcessorService.extractText(
              doc.filePath,
              doc.fileType as FileType,
            );
            fileContent = content.text.slice(0, 8000); // 取前 8000 字符控制 token 用量
          } catch (err) {
            self.logger.error(`文档解析失败 (docId=${input.documentId})：${err}`);
            return JSON.stringify({
              summary: '文档解析失败，请稍后重试。',
              documentTitle: doc.title,
            } as SummarizeOutput);
          }
          if (!fileContent) {
            return JSON.stringify({
              summary: '文档文件不可用。',
              documentTitle: doc.title,
            } as SummarizeOutput);
          }

          // 4. 生成摘要
          const systemPrompt = `你是一个专业的文档摘要生成器。请用 200 字以内的简洁中文总结以下文档内容。
只输出摘要文本，不要添加额外说明。`;

          const summary = await self.llmService.ask(systemPrompt, `文档标题：${doc.title}\n\n文档内容：\n${fileContent}`);

          return JSON.stringify({
            summary,
            documentTitle: doc.title,
          } as SummarizeOutput);
        } catch (error) {
          self.logger.error(`摘要生成失败：${error}`);
          return JSON.stringify({
            summary: `摘要生成失败：${error}`,
            documentTitle: '',
          } as SummarizeOutput);
        }
      },
      {
        name: 'summarize_document',
        description: '对指定的文档生成摘要，帮助用户快速了解文档要点。',
        schema: z.object({
          documentId: z.string().describe('要生成摘要的文档 ID'),
        }),
      },
    );
  }
}
