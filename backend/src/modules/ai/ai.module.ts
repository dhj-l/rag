import { Global, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

/**
 * AI 模块（T01 最小骨架）
 *
 * T01 仅注册并全局导出核心跨模块服务 PermissionService，供 T02/T04 直接注入。
 * T03 将在此扩展：LlmService、EmbeddingService、VectorStoreService、
 * DocumentProcessorService、AgentService、LangfuseService 及 tools/*。
 *
 * @Global()：PermissionService 定位为架构级共享服务（§1.1 / §7.3），
 *            全局可注入，避免各模块重复 import AiModule。
 */
@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class AiModule {}
