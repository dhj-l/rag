import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, extname } from 'path';
import {
  AuditAction,
  DocumentStatus,
  FileType,
  SecurityLevel,
  UserContext,
} from '../../common/types/common.types';
import { PermissionService } from '../ai/permission.service';
import { DocumentProcessorService } from '../ai/document-processor.service';
import { VectorStoreService } from '../ai/vector-store.service';
import { LlmService } from '../ai/llm.service';
import { AuditService } from '../audit/audit.service';
import { Document, DocumentDocument, DocumentResponse } from './document.schema';
import { UploadDocumentDto, DocumentListQueryDto } from './dto/document.dto';

/** 扩展名 → FileType 映射（§7.5 支持格式） */
const EXT_FILE_TYPE: Record<string, FileType> = {
  '.pdf': FileType.PDF,
  '.txt': FileType.TXT,
  '.md': FileType.MARKDOWN,
  '.markdown': FileType.MARKDOWN,
};

/** 由文件名推导 FileType；不支持返回 null */
export function deriveFileType(filename: string): FileType | null {
  const ext = extname(filename).toLowerCase();
  return EXT_FILE_TYPE[ext] ?? null;
}

/**
 * 文档业务服务（§3.6 文档接口、§4.1 上传索引流程、§7.3 权限过滤）
 *
 * 所有文档访问入口均通过 PermissionService，绝不在业务代码手写过滤（§7.3 反模式）。
 * 上传后异步触发 DocumentProcessorService 处理流水线，不阻塞 API 响应。
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;

  constructor(
    @InjectModel(Document.name) private readonly documentModel: Model<DocumentDocument>,
    private readonly permissionService: PermissionService,
    private readonly documentProcessorService: DocumentProcessorService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly llmService: LlmService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {
    this.uploadDir = this.configService.get<string>('upload.dir') ?? './uploads';
    this.maxFileSize = this.configService.get<number>('upload.maxFileSize') ?? 20 * 1024 * 1024;
  }

  /**
   * 上传文档（§4.1）
   * 1. 校验文件大小 / 类型
   * 2. 创建 MongoDB 记录（status: uploaded）
   * 3. 写文件到 ${uploadDir}/${id}-${原始文件名}
   * 4. 异步触发 processDocument（回调更新状态）
   * 5. 返回透传结构 { code:201, ... }（绕过 TransformInterceptor 默认 200）
   */
  async upload(
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    user: UserContext,
  ): Promise<{ code: number; data: { documentId: string; status: string }; message: string }> {
    if (!file?.buffer) {
      throw new HttpException('未收到上传文件', HttpStatus.BAD_REQUEST);
    }
    if (file.size > this.maxFileSize) {
      throw new HttpException('文件大小不能超过 20MB', HttpStatus.PAYLOAD_TOO_LARGE);
    }

    const fileType = deriveFileType(file.originalname);
    if (!fileType) {
      throw new HttpException('不支持的文件类型，仅允许 pdf/txt/md/markdown', HttpStatus.BAD_REQUEST);
    }

    const securityLevel = dto.securityLevel;
    const department = dto.department ?? 'all';

    // 1. 创建记录拿到 _id
    const created = await this.documentModel.create({
      title: dto.title,
      filename: file.originalname,
      fileType,
      fileSize: file.size,
      filePath: '', // 占位，写盘后回填
      securityLevel,
      department,
      status: DocumentStatus.UPLOADED,
      uploadedBy: user.userId as any,
    });

    const docId = String(created._id);
    const filePath = join(this.uploadDir, `${docId}-${file.originalname}`);

    // 2. 写盘
    try {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.buffer);
    } catch (err) {
      await this.documentModel.findByIdAndDelete(docId).exec();
      throw new HttpException(`文件保存失败：${err}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    created.filePath = filePath;
    await created.save();

    // 3. 审计 UPLOAD
    await this.auditService.record({
      user,
      action: AuditAction.UPLOAD,
      resource: 'document',
      resourceId: docId,
      filterCondition: { securityLevel, department, fileType, fileSize: file.size },
    });

    // 4. 异步触发处理流水线（不阻塞响应）
    void this.processAsync(docId, filePath, fileType, securityLevel, department, dto.title);

    this.logger.log(`[${docId}] 文档上传成功：${dto.title}（${file.originalname}）`);

    return {
      code: 201,
      data: { documentId: docId, status: DocumentStatus.UPLOADED },
      message: '上传成功',
    };
  }

  /** 异步执行文档处理流水线，失败仅记日志（API 已返回） */
  private async processAsync(
    docId: string,
    filePath: string,
    fileType: FileType,
    securityLevel: SecurityLevel,
    department: string,
    title: string,
  ): Promise<void> {
    try {
      await this.documentProcessorService.processDocument(
        docId,
        filePath,
        fileType,
        securityLevel,
        department,
        title,
        async (id, status, extra) => {
          const update: Record<string, unknown> = { status };
          if (extra?.chunkCount !== undefined) update.chunkCount = extra.chunkCount;
          if (extra?.errorMessage !== undefined) update.errorMessage = extra.errorMessage;
          await this.documentModel.updateOne({ _id: id }, { $set: update }).exec();
        },
      );
    } catch (err) {
      // processDocument 内部已通过回调写入 failed 状态；此处仅记日志
      this.logger.error(`[${docId}] 异步处理流水线异常：${err}`);
    }
  }

  /** 文档列表（权限过滤，§7.3 buildMongoQuery） */
  async findAll(
    query: DocumentListQueryDto,
    user: UserContext,
  ): Promise<{ list: DocumentResponse[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, query.pageSize ?? 20);
    const skip = (page - 1) * pageSize;

    const filter = this.permissionService.buildMongoQuery(user);

    const [docs, total] = await Promise.all([
      this.documentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize).exec(),
      this.documentModel.countDocuments(filter).exec(),
    ]);

    return { list: docs.map((d) => this.toResponse(d)), total };
  }

  /** 查询索引状态（§3.6 GET /:id/status） */
  async findStatus(
    id: string,
    user: UserContext,
  ): Promise<{ documentId: string; status: DocumentStatus; chunkCount?: number; errorMessage?: string }> {
    const doc = await this.documentModel.findById(id).exec();
    if (!doc) {
      throw new HttpException('文档不存在', HttpStatus.NOT_FOUND);
    }
    this.ensureAccess(user, doc);

    const result: { documentId: string; status: DocumentStatus; chunkCount?: number; errorMessage?: string } = {
      documentId: String(doc._id),
      status: doc.status,
    };
    if (doc.chunkCount) result.chunkCount = doc.chunkCount;
    if (doc.errorMessage) result.errorMessage = doc.errorMessage;
    return result;
  }

  /**
   * 获取文档摘要（§3.6 GET /:id/summary）
   * 直接读文件 + LlmService.ask 生成（复用 SummarizeTool 的提示词），不经过 Agent。
   */
  async getSummary(
    id: string,
    user: UserContext,
  ): Promise<{ summary: string; documentTitle: string }> {
    const doc = await this.documentModel.findById(id).exec();
    if (!doc) {
      throw new HttpException('文档不存在', HttpStatus.NOT_FOUND);
    }
    if (!this.permissionService.canViewSummary(user, this.toPermissionDoc(doc))) {
      throw new HttpException('没有权限查看该文档摘要', HttpStatus.FORBIDDEN);
    }

    if (!doc.filePath || !existsSync(doc.filePath)) {
      throw new HttpException('文档文件不可用', HttpStatus.NOT_FOUND);
    }

    const { readFileSync } = await import('fs');
    const fileContent = readFileSync(doc.filePath, 'utf-8').slice(0, 8000);

    const systemPrompt = `你是一个专业的文档摘要生成器。请用 200 字以内的简洁中文总结以下文档内容。
只输出摘要文本，不要添加额外说明。`;
    const summary = await this.llmService.ask(
      systemPrompt,
      `文档标题：${doc.title}\n\n文档内容：\n${fileContent}`,
    );

    await this.auditService.record({
      user,
      action: AuditAction.SUMMARIZE,
      resource: 'document',
      resourceId: String(doc._id),
    });

    return { summary, documentTitle: doc.title };
  }

  /** 删除文档（admin）：文件 + 向量库 + MongoDB 记录（§5.3 要点 4） */
  async remove(id: string, user: UserContext): Promise<void> {
    const doc = await this.documentModel.findById(id).exec();
    if (!doc) {
      throw new HttpException('文档不存在', HttpStatus.NOT_FOUND);
    }

    // best-effort 删除文件
    if (doc.filePath) {
      try {
        await unlink(doc.filePath);
      } catch (err) {
        this.logger.warn(`[${id}] 删除文件失败（忽略）：${err}`);
      }
    }

    // 删除向量库索引
    try {
      await this.vectorStoreService.deleteByDocumentId(id);
    } catch (err) {
      this.logger.warn(`[${id}] 删除向量索引失败（忽略）：${err}`);
    }

    await this.documentModel.findByIdAndDelete(id).exec();

    await this.auditService.record({
      user,
      action: AuditAction.DELETE,
      resource: 'document',
      resourceId: id,
    });

    this.logger.log(`[${id}] 文档已删除`);
  }

  /** 权限校验：无访问权限抛 403 */
  private ensureAccess(user: UserContext, doc: DocumentDocument): void {
    if (!this.permissionService.canAccessDocument(user, this.toPermissionDoc(doc))) {
      throw new HttpException('没有权限访问该文档', HttpStatus.FORBIDDEN);
    }
  }

  /** 转为 PermissionService 所需的最小 Document 结构 */
  private toPermissionDoc(doc: DocumentDocument) {
    return {
      id: String(doc._id),
      title: doc.title,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      securityLevel: doc.securityLevel as SecurityLevel,
      department: doc.department ?? 'all',
      status: doc.status,
    };
  }

  /** 转 DocumentResponse（剥离 filePath） */
  private toResponse(doc: DocumentDocument): DocumentResponse {
    return {
      id: String(doc._id),
      title: doc.title,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      securityLevel: doc.securityLevel as SecurityLevel,
      department: doc.department ?? 'all',
      status: doc.status,
      chunkCount: doc.chunkCount ?? 0,
      uploadedBy: doc.uploadedBy ? String(doc.uploadedBy) : '',
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
