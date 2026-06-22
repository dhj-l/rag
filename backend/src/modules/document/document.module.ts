import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Document, DocumentSchema } from './document.schema';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

/**
 * 文档模块（§3.6 文档接口）
 *
 * 注册 documents 集合的 Document 模型（T04 由 ai/ 迁入）。
 * PermissionService / DocumentProcessorService / VectorStoreService / LlmService / AuditService
 * 均为 @Global 全局服务，无需在此 import。
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: Document.name, schema: DocumentSchema }])],
  providers: [DocumentService],
  controllers: [DocumentController],
  exports: [DocumentService, MongooseModule],
})
export class DocumentModule {}
