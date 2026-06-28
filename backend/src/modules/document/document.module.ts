import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from './document.schema';
import { SessionModule } from '../session/session.module';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

/**
 * 文档模块（§3.6 文档接口）
 *
 * 注册 documents 集合的 Document 模型（T04 由 ai/ 迁入）。
 * PermissionService / DocumentProcessorService / VectorStoreService / LlmService / AuditService
 * 均为 @Global 全局服务，无需在此 import。
 *
 * imports SessionModule 以注入 MessageModel——B2 问答热度统计需聚合 messages.sources
 * 统计文档被提问次数（SessionModule 已注册并导出 Message 模型）。
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }]),
    SessionModule, // 为注入 MessageModel（B2 热度统计）
  ],
  providers: [DocumentService],
  controllers: [DocumentController],
  exports: [DocumentService, MongooseModule],
})
export class DocumentModule {}
