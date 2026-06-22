import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserContext } from '../../common/types/common.types';
import { Message, MessageDocument } from '../chat/message.schema';
import {
  Session,
  SessionDocument,
  SessionResponse,
  SessionDetailResponse,
  MessageBrief,
} from './session.schema';
import { CreateSessionDto, SessionListQueryDto, UpdateSessionDto } from './dto/session.dto';

/**
 * 会话业务服务（§3.6 会话接口）
 *
 * 会话隔离：所有查询都附加 userId 过滤，确保用户只能访问自己的会话
 * （不存在与无权限均返回 404，避免泄露存在性）。
 */
@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
  ) {}

  /** 创建会话 */
  async create(user: UserContext, dto: CreateSessionDto): Promise<SessionResponse> {
    const session = await this.sessionModel.create({
      userId: user.userId as any,
      title: dto.title?.trim() || '新会话',
      lastMessageAt: new Date(),
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

  /** 重命名 */
  async rename(user: UserContext, id: string, dto: UpdateSessionDto): Promise<SessionResponse> {
    const session = await this.sessionModel
      .findOneAndUpdate(
        { _id: id, userId: user.userId },
        { title: dto.title.trim() },
        { new: true },
      )
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

  private toResponse(doc: SessionDocument): SessionResponse {
    return {
      id: String(doc._id),
      title: doc.title,
      lastMessageAt: doc.lastMessageAt,
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
