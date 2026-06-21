import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PermissionService } from './permission.service';
import { LlmService } from './llm.service';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';
import { DocumentProcessorService } from './document-processor.service';
import { AgentService } from './agent.service';
import { LangfuseService } from './langfuse.service';
import { RagSearchTool } from './tools/rag-search.tool';
import { SummarizeTool } from './tools/summarize.tool';
import { GeneralChatTool } from './tools/general-chat.tool';
import { DocumentSchema } from './document.schema';

/**
 * AI 模块（ARCHITECTURE.md §1.1 / T03 全部 AI 核心服务注册）
 *
 * @Global() 定位为架构级共享模块，T04 各业务模块可直接注入任何 AI 服务。
 *
 * 注册的服务：
 * - PermissionService（T01 已有）：权限过滤核心
 * - LlmService（T03 新增）：ChatDeepSeek 封装
 * - EmbeddingService（T03 新增）：AlibabaTongyiEmbeddings 封装
 * - VectorStoreService（T03 新增）：Chroma 向量库抽象层
 * - DocumentProcessorService（T03 新增）：文档处理 4 阶段流水线
 * - AgentService（T03 新增）：createAgent + 中间件管道
 * - LangfuseService（T03 新增）：追踪回调处理器
 * - RagSearchTool / SummarizeTool / GeneralChatTool（T03 新增）：Agent 工具
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Document', schema: DocumentSchema }]),
  ],
  providers: [
    // 核心跨模块服务（T01）
    PermissionService,
    // AI 核心服务（T03）
    LlmService,
    EmbeddingService,
    VectorStoreService,
    DocumentProcessorService,
    AgentService,
    LangfuseService,
    // Agent 工具（T03）
    RagSearchTool,
    SummarizeTool,
    GeneralChatTool,
  ],
  exports: [
    PermissionService,
    LlmService,
    EmbeddingService,
    VectorStoreService,
    DocumentProcessorService,
    AgentService,
    LangfuseService,
  ],
})
export class AiModule {}
