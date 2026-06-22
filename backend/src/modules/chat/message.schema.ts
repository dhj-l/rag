import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';
import { MessageRole } from '../../common/types/common.types';

/**
 * 来源引用子文档（§3.2 messages.sources[]）
 * 仅 assistant 消息携带。
 */
@Schema({ _id: false })
export class SourceReferenceItem {
  @Prop({ type: String, required: true })
  documentId!: string;

  @Prop({ type: String, required: true })
  documentTitle!: string;

  @Prop({ type: String, required: true })
  chunkContent!: string;

  @Prop({ type: Number, required: true })
  chunkIndex!: number;

  @Prop({ type: Number, default: 0 })
  page!: number;

  @Prop({ type: String, required: true })
  securityLevel!: string;
}

/**
 * Message Mongoose Schema（messages 集合，ARCHITECTURE.md §3.2）
 *
 * - sessionId：所属会话（索引）
 * - userId：冗余用户 ID，便于隔离查询
 * - role：user / assistant
 * - sources：仅 assistant 消息的来源引用
 * - toolUsed / tokenCount：可选，便于审计与分析
 */
@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false })
export class Message {
  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'Session', index: true })
  sessionId!: MSchema.Types.ObjectId;

  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: MSchema.Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(MessageRole) })
  role!: MessageRole;

  @Prop({ type: String, required: true })
  content!: string;

  @Prop({ type: [SourceReferenceItem], default: [] })
  sources!: SourceReferenceItem[];

  @Prop({ type: String, required: false })
  toolUsed?: string;

  @Prop({ type: Number, required: false })
  tokenCount?: number;

  createdAt!: Date;
}

export type MessageDocument = HydratedDocument<Message>;
export const MessageSchema = SchemaFactory.createForClass(Message);

// 会话内按时间排序检索
MessageSchema.index({ sessionId: 1, createdAt: 1 });
