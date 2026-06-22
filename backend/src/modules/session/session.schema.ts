import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';

/**
 * Session Mongoose Schema（sessions 集合，ARCHITECTURE.md §3.2）
 *
 * - userId：所属用户（复合索引 {userId, updatedAt}，§3.2）
 * - title：会话标题，取首条消息摘要或自动命名（默认「新会话」）
 * - lastMessageAt：最后消息时间，用于列表排序
 */
@Schema({ timestamps: true, versionKey: false })
export class Session {
  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: MSchema.Types.ObjectId;

  @Prop({ type: String, required: true, default: '新会话' })
  title!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  lastMessageAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

// §3.2 复合索引：用户会话按更新时间倒序
SessionSchema.index({ userId: 1, updatedAt: -1 });

/**
 * 会话响应（§3.6）
 */
export interface SessionResponse {
  id: string;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** 会话详情（含消息历史，GET /api/sessions/:id） */
export interface SessionDetailResponse extends SessionResponse {
  messages: MessageBrief[];
}

export interface MessageBrief {
  id: string;
  role: string;
  content: string;
  sources?: SourceReferenceBrief[];
  toolUsed?: string;
  createdAt: Date;
}

export interface SourceReferenceBrief {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  chunkIndex: number;
  page: number;
  securityLevel: string;
}
