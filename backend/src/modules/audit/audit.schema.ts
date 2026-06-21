import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';
import { AuditAction, AUDIT_LOG_TTL_DAYS } from '../../common/types/common.types';

/**
 * AuditLog Mongoose Schema（audit_logs 集合，ARCHITECTURE.md §3.2）
 *
 * - expiresAt = createdAt + 90 天，TTL 索引自动删除（§3.2 / §7.2）。
 * - filterCondition：Mixed 类型，记录检索操作的权限过滤条件等。
 */
@Schema({ timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false })
export class AuditLog {
  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'User' })
  userId!: MSchema.Types.ObjectId;

  @Prop({ type: String, required: true })
  username!: string;

  @Prop({ type: String, required: true, enum: Object.values(AuditAction), index: true })
  action!: AuditAction;

  @Prop({ type: String, required: false })
  resource?: string;

  @Prop({ type: String, required: false })
  resourceId?: string;

  @Prop({ type: MSchema.Types.Mixed, required: false })
  filterCondition?: Record<string, unknown>;

  @Prop({ type: Number, required: false })
  resultCount?: number;

  @Prop({ type: String, required: false })
  ipAddress?: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;
}

export type AuditLogDocument = HydratedDocument<AuditLog>;
export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// TTL 索引：expiresAt 到期自动删除（§3.2 audit_logs.expiresAt，90 天）
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// 预设 createdAt + expiresAt（expiresAt = createdAt + 90 天）
AuditLogSchema.pre('validate', function (this: AuditLogDocument, next) {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  if (!this.expiresAt) {
    const expires = new Date(this.createdAt);
    expires.setDate(expires.getDate() + AUDIT_LOG_TTL_DAYS);
    this.expiresAt = expires;
  }
  next();
});
