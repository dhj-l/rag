import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import {
  AuditAction,
  MessageRole,
  SSEEvent,
  SSEEventType,
  SourceReference,
  UserContext,
} from '../../common/types/common.types';
import { AgentService } from '../ai/agent.service';
import { LlmService } from '../ai/llm.service';
import { AuditService } from '../audit/audit.service';
import { Message, MessageDocument } from './message.schema';
import { Session, SessionDocument } from '../session/session.schema';

/** 多轮上下文：最近 5 轮 = 10 条消息（§7.6） */
const MAX_HISTORY_MESSAGES = 10;

/** 默认会话标题，首条消息后自动命名（§3.2） */
const DEFAULT_SESSION_TITLE = '新会话';

/**
 * 对话编排服务（§4.2 RAG 问答流程）
 *
 * 流程：校验会话归属 → 存用户消息 → 加载历史 → 调用 AgentService.streamChat
 * → 边 yield 边累积（TOKEN/SOURCES/TOOL）→ finally 持久化助手消息 + 更新会话 + 审计。
 *
 * 用 finally 保证客户端中断也能保存已生成的部分回复。
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    private readonly agentService: AgentService,
    private readonly auditService: AuditService,
    private readonly llmService: LlmService,
  ) {}

  async *streamMessage(
    sessionId: string,
    message: string,
    user: UserContext,
  ): AsyncGenerator<SSEEvent> {
    // 1. 校验会话归属（不存在/非本人均 404）
    const session = await this.sessionModel
      .findOne({ _id: sessionId, userId: user.userId })
      .exec();
    if (!session) {
      throw new HttpException('会话不存在', HttpStatus.NOT_FOUND);
    }

    // 2. 加载历史（存用户消息之前，避免把当前消息算入历史）
    const history = await this.loadHistory(sessionId);

    // 3. 存用户消息
    await this.messageModel.create({
      sessionId: session._id,
      userId: user.userId as any,
      role: MessageRole.USER,
      content: message,
      sources: [],
    });

    // 4. 流式调用 Agent，边转发边累积
    // F-15：取出会话关联文档，透传给 Agent 限定检索范围（多文档问答）
    const documentIds = (session.documentIds ?? []).map((d) => String(d));
    let fullContent = '';
    const sources: SourceReference[] = [];
    let toolUsed = '';

    try {
      for await (const evt of this.agentService.streamChat(sessionId, message, user, history, documentIds)) {
        if (evt.type === SSEEventType.TOKEN && evt.content) {
          fullContent += evt.content;
        } else if (evt.type === SSEEventType.SOURCES && evt.data) {
          sources.push(...evt.data);
        } else if (evt.type === SSEEventType.TOOL && evt.name) {
          toolUsed = evt.name;
        }
        yield evt;
      }
    } finally {
      // 5. 持久化助手消息 + 更新会话 + 审计（即使中断也执行）
      await this.persistAfterStream(session, message, fullContent, sources, toolUsed, user).catch(
        (err) => this.logger.error(`会话 ${sessionId} 后续持久化失败：${err}`),
      );
    }
  }

  /** 加载最近 MAX_HISTORY_MESSAGES 条历史，转为 LangChain BaseMessage[]（§7.6） */
  private async loadHistory(sessionId: string): Promise<BaseMessage[]> {
    const docs = await this.messageModel
      .find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(MAX_HISTORY_MESSAGES)
      .exec();
    // 倒序取出后翻转为正序，保证时间从早到晚
    return docs.reverse().map((d) =>
      d.role === MessageRole.ASSISTANT
        ? new AIMessage(d.content)
        : new HumanMessage(d.content),
    );
  }

  /** 流结束后持久化：助手消息 + 会话时间/标题 + 审计 */
  private async persistAfterStream(
    session: SessionDocument,
    userMessage: string,
    fullContent: string,
    sources: SourceReference[],
    toolUsed: string,
    user: UserContext,
  ): Promise<void> {
    if (fullContent) {
      await this.messageModel.create({
        sessionId: session._id,
        userId: user.userId as any,
        role: MessageRole.ASSISTANT,
        content: fullContent,
        sources: sources.map((s) => ({
          documentId: s.documentId,
          documentTitle: s.documentTitle,
          chunkContent: s.chunkContent,
          chunkIndex: s.chunkIndex,
          page: s.page,
          securityLevel: String(s.securityLevel),
        })),
        toolUsed: toolUsed || undefined,
        // F-11：token 用量估算（精确值由 Langfuse 记录，此处为 message 层粗估）
        tokenCount: this.llmService.estimateTokens(fullContent),
      });
    }

    // 更新最后消息时间；首条消息自动命名会话标题（§3.2）
    const update: Record<string, unknown> = { lastMessageAt: new Date() };
    if (session.title === DEFAULT_SESSION_TITLE && userMessage.trim()) {
      update.title = userMessage.trim().slice(0, 20);
    }
    await this.sessionModel.updateOne({ _id: session._id }, { $set: update }).exec();

    // 审计：rag_search → SEARCH，summarize_document → SUMMARIZE，其余不记
    if (toolUsed === 'rag_search') {
      await this.auditService.record({
        user,
        action: AuditAction.SEARCH,
        resource: 'session',
        resourceId: String(session._id),
        filterCondition: this.auditService.buildFilterCondition(user) as any,
        resultCount: sources.length,
      });
    } else if (toolUsed === 'summarize_document') {
      await this.auditService.record({
        user,
        action: AuditAction.SUMMARIZE,
        resource: 'session',
        resourceId: String(session._id),
      });
    }
  }
}
