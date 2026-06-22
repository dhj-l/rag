import { Prop, Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MSchema } from 'mongoose';
import { DocumentStatus, FileType, SecurityLevel } from '../../common/types/common.types';

/**
 * 文档 Mongoose Schema（documents 集合，ARCHITECTURE.md §3.2）
 *
 * T04 由 ai/ 迁移至 document 模块，并由 DocumentModule 注册导出。
 * 集合名固定为 `documents`、字段名不变——SummarizeTool 通过 raw
 * `connection.collection('documents')` 读取这些字段，不可改动。
 *
 * - securityLevel：L1/L2/L3/L4（§3.8 权限矩阵）
 * - department：L1/L4 为 'all'，L2/L3 为具体部门名（§3.3）
 * - status：uploaded → parsing → embedding → completed / failed（§4.1）
 * - uploadedBy：ObjectId ref users（§3.2）
 */
@MongooseSchema({ timestamps: true, collection: 'documents', versionKey: false })
export class Document {
  @Prop({ type: String, required: true, index: true, trim: true })
  title!: string;

  @Prop({ type: String, required: true })
  filename!: string;

  @Prop({ type: String, required: true, enum: Object.values(FileType) })
  fileType!: FileType;

  @Prop({ type: Number, required: true })
  fileSize!: number;

  @Prop({ type: String, required: true })
  filePath!: string;

  @Prop({ type: String, required: true, enum: Object.values(SecurityLevel) })
  securityLevel!: SecurityLevel;

  @Prop({ type: String, required: true, default: 'all' })
  department!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.UPLOADED,
  })
  status!: DocumentStatus;

  @Prop({ type: Number, default: 0 })
  chunkCount!: number;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: MSchema.Types.ObjectId, required: true, ref: 'User' })
  uploadedBy!: MSchema.Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}

export type DocumentDocument = HydratedDocument<Document>;
export const DocumentSchema = SchemaFactory.createForClass(Document);

// 索引
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ status: 1 });

/**
 * 文档响应（剥离 filePath 等内部字段，§3.6 DocumentResponse）
 * 供文档列表 / 状态 / 详情接口使用。
 */
export interface DocumentResponse {
  id: string;
  title: string;
  filename: string;
  fileType: FileType;
  fileSize: number;
  securityLevel: SecurityLevel;
  department: string;
  status: DocumentStatus;
  chunkCount: number;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
