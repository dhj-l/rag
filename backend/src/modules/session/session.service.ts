import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SecurityLevel, UserContext } from '../../common/types/common.types';
import { Message, MessageDocument } from '../chat/message.schema';
import { Document as DocumentModel, DocumentDocument } from '../document/document.schema';
import {
  Session,
  SessionDocument,
  SessionResponse,
  SessionDetailResponse,
  MessageBrief,
} from './session.schema';
import { PermissionService } from '../ai/permission.service';
import { CreateSessionDto, SessionListQueryDto, UpdateSessionDto } from './dto/session.dto';

/**
 * 会话业务服务（§3.6 会话接口）
 *
 * 会话隔离：所有查询都附加 userId 过滤，确保用户只能访问自己的会话
 * （不存在与无权限均返回 404，避免泄露存在性）。
 *
 * F-15 多文档问答：会话可关联多个文档（documentIds），创建/更新时校验
 * 每个文档存在且用户有权访问（PRD §2.3"仅可关联有权限的文档"）。
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(DocumentModel.name) private readonly documentModel: Model<DocumentDocument>,
    private readonly permissionService: PermissionService,
  ) {}

  /** 创建会话 */
  async create(user: UserContext, dto: CreateSessionDto): Promise<SessionResponse> {
    // F-15：校验关联文档存在且用户有权访问
    const documentIds = await this.validateDocumentIds(user, dto.documentIds);
    const session = await this.sessionModel.create({
      userId: user.userId as any,
      title: dto.title?.trim() || '新会话',
      lastMessageAt: new Date(),
      documentIds, // F-15 关联文档（空数组表示不限定）
    });
    return this.toResponse(session);
  }

  /** 会话列表（仅本人，按 updatedAt 倒序） */
  async findAll(user: UserContext, query: SessionListQueryDto): Promise<{ list: SessionResponse[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 50);
    const skip = (page - 1) * pageSize;

    const filter = { userId: user.userId };
    const [docs, total] = await Promise.all([
      this.sessionModel.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.sessionModel.countDocuments(filter).exec(),
    ]);

    return { list: docs.map((d) => this.toResponse(d)), total };
  }

  /** 会话详情（含消息历史） */
  async findOne(user: UserContext, id: string): Promise<SessionDetailResponse> {
    const session = await this.sessionModel.findOne({ _id: id, userId: user.userId }).exec();
    if (!session) {
      throw new HttpException('会话不存在', HttpStatus.NOT_FOUND);
    }

    const messages = await this.messageModel
      .find({ sessionId: id })
      .sort({ createdAt: 1 })
      .exec();

    return {
      ...this.toResponse(session),
      messages: messages.map((m) => this.toMessageBrief(m)),
    };
  }

  /** 重命名（可选同时更新关联文档，F-15） */
  async rename(user: UserContext, id: string, dto: UpdateSessionDto): Promise<SessionResponse> {
    // F-15：若传入 documentIds 则校验权限并替换关联文档
    const update: Record<string, unknown> = { title: dto.title.trim() };
    if (dto.documentIds !== undefined) {
      update.documentIds = await this.validateDocumentIds(user, dto.documentIds);
    }

    const session = await this.sessionModel
      .findOneAndUpdate({ _id: id, userId: user.userId }, { $set: update }, { new: true })
      .exec();
    if (!session) {
      throw new HttpException('会话不存在', HttpStatus.NOT_FOUND);
    }
    return this.toResponse(session);
  }

  /** 删除会话（连带删除消息） */
  async remove(user: UserContext, id: string): Promise<void> {
    const session = await this.sessionModel.findOneAndDelete({ _id: id, userId: user.userId }).exec();
    if (!session) {
      throw new HttpException('会话不存在', HttpStatus.NOT_FOUND);
    }
    await this.messageModel.deleteMany({ sessionId: id }).exec();
    this.logger.log(`会话 ${id} 及其消息已删除`);
  }

  /**
   * F-15：校验会话关联文档列表
   *
   * 规则（PRD §2.3"仅可关联有权限的文档"）：
   * 1. 每个 ID 须存在（不存在/已删除 → 404）
   * 2. 用户对该文档须有访问权限 canAccessDocument（无权限 → 403）
   *
   * @returns 去重后的合法文档 ID 数组（mongoose 写入时自动转 ObjectId）
   */
  private async validateDocumentIds(user: UserContext, ids?: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    const uniqueIds = Array.from(new Set(ids));

    const docs = await this.documentModel.find({ _id: { $in: uniqueIds } }).exec();
    // 存在性校验：请求 ID 必须全部命中
    if (docs.length !== uniqueIds.length) {
      throw new HttpException('关联文档不存在或已删除', HttpStatus.NOT_FOUND);
    }
    // 权限校验：每个文档用户须有权访问
    for (const doc of docs) {
      const accessible = this.permissionService.canAccessDocument(user, {
        id: String(doc._id),
        title: doc.title,
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        securityLevel: doc.securityLevel as SecurityLevel,
        department: doc.department ?? 'all',
        status: doc.status,
      });
      if (!accessible) {
        throw new HttpException(`无权限关联文档：${doc.title}`, HttpStatus.FORBIDDEN);
      }
    }
    return uniqueIds;
  }

  private toResponse(doc: SessionDocument): SessionResponse {
    return {
      id: String(doc._id),
      title: doc.title,
      lastMessageAt: doc.lastMessageAt,
      // F-15：ObjectId 数组转字符串数组返回
      documentIds: (doc.documentIds ?? []).map((d) => String(d)),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private toMessageBrief(m: MessageDocument): MessageBrief {
    return {
      id: String(m._id),
      role: m.role,
      content: m.content,
      sources: (m.sources ?? []).map((s) => ({
        documentId: s.documentId,
        documentTitle: s.documentTitle,
        chunkContent: s.chunkContent,
        chunkIndex: s.chunkIndex,
        page: s.page,
        securityLevel: s.securityLevel,
      })),
      toolUsed: m.toolUsed,
      createdAt: m.createdAt,
    };
  }
}
