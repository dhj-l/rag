import { Prop, Schema as MongooseSchema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongoDoc } from 'mongoose';
import { DocumentStatus, FileType } from '../../common/types/common.types';

/**
 * 文档 Mongoose Schema（T03 最小版本，§3.2 documents 集合）
 *
 * T03 阶段仅包含 document-processor 所需字段（状态更新）；T04 将在此 Schema 上补充
 * 完整字段（title/filename/fileType/fileSize/filePath/securityLevel/department/uploadedBy）。
 */
@MongooseSchema({ timestamps: true, collection: 'documents' })
export class Document {
  @Prop({ type: String, required: false, index: true })
  title!: string;

  @Prop({ type: String, required: false })
  filename!: string;

  @Prop({ type: String, enum: Object.values(FileType), default: FileType.TXT })
  fileType!: FileType;

  @Prop({ type: Number, default: 0 })
  fileSize!: number;

  @Prop({ type: String, required: false })
  filePath!: string;

  @Prop({ type: String, enum: ['L1', 'L2', 'L3', 'L4'], default: 'L1' })
  securityLevel!: string;

  @Prop({ type: String, default: 'all' })
  department!: string;

  @Prop({
    type: String,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.UPLOADED,
  })
  status!: DocumentStatus;

  @Prop({ type: Number, default: 0 })
  chunkCount!: number;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: String, required: false })
  uploadedBy?: string;
}

export type DocumentDocument = Document & MongoDoc;
export const DocumentSchema = SchemaFactory.createForClass(Document);

// 索引
DocumentSchema.index({ uploadedBy: 1 });
DocumentSchema.index({ status: 1 });
