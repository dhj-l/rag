import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';

/**
 * Session Mongoose Schema（sessions 集合，ARCHITECTURE.md §3.2）
 *
 * - userId：所属用户（复合索引 {userId, updatedAt}，§3.2）
 * - title：会话标题，取首条消息摘要或自动命名（默认「新会话」）
 * - lastMessageAt：最后消息时间，用于列表排序
 * - documentIds：F-15 会话关联文档（多文档问答），限定本会话检索范围到这些文档；
 *   默认空数组表示不限定；关联时需通过权限校验（PRD §2.3 仅可关联有权限文档）
 */
@Schema({ timestamps: true, versionKey: false })
export class Session {
  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: MSchema.Types.ObjectId;

  @Prop({ type: String, required: true, default: '新会话' })
  title!: string;

  @Prop({ type: Date, required: true, default: Date.now })
  lastMessageAt!: Date;

  // F-15：关联文档 ID 数组（ref Document），默认空
  @Prop({ type: [{ type: MSchema.Types.ObjectId, ref: 'Document' }], default: [] })
  documentIds!: MSchema.Types.ObjectId[];

  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;
export const SessionSchema = SchemaFactory.createForClass(Session);

// §3.2 复合索引：用户会话按更新时间倒序
SessionSchema.index({ userId: 1, updatedAt: -1 });

/**
 * 会话响应（§3.6；F-15 含关联文档 ID 列表）
 */
export interface SessionResponse {
  id: string;
  title: string;
  lastMessageAt: Date;
  documentIds: string[]; // F-15 会话关联文档
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
