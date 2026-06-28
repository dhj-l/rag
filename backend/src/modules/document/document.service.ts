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
import { Message, MessageDocument } from '../chat/message.schema';
import {
  UploadDocumentDto,
  DocumentListQueryDto,
  UpdateDocumentSecurityDto,
  SummarizeRangeDto,
} from './dto/document.dto';

/** 扩展名 → FileType 映射（§7.5 支持格式；F-12 新增 docx） */
const EXT_FILE_TYPE: Record<string, FileType> = {
  '.pdf': FileType.PDF,
  '.txt': FileType.TXT,
  '.md': FileType.MARKDOWN,
  '.markdown': FileType.MARKDOWN,
  '.docx': FileType.DOCX, // F-12 Word 文档
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
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
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

  /**
   * 问答热度统计（US-F7 / Q-E04，P1；GET /api/documents/heat，admin）
   *
   * 聚合 messages 集合中 assistant 消息的 sources，按 documentId 统计被检索次数，
   * 帮助管理员了解新员工常见困惑点（哪些文档被提问最多）。
   * 已删除文档标题标记"已删除"并保留计数（热度仍反映历史提问）。
   *
   * 说明：统计口径为"文档作为检索来源出现的次数"——每次 rag_search 命中该文档的
   * chunk 均计 1 次，反映文档被引用的活跃度。
   */
  async getHeat(): Promise<
    Array<{ documentId: string; title: string; questionCount: number; lastAskedAt: Date }>
  > {
    // 聚合管道：assistant 消息 → 展开 sources → 按 documentId 分组计数 + 取最近时间
    const rows = await this.messageModel.aggregate<{
      _id: string;
      questionCount: number;
      lastAskedAt: Date;
    }>([
      { $match: { role: 'assistant', sources: { $exists: true, $ne: [] } } },
      { $unwind: '$sources' },
      {
        $group: {
          _id: '$sources.documentId',
          questionCount: { $sum: 1 },
          lastAskedAt: { $max: '$createdAt' },
        },
      },
      { $sort: { questionCount: -1 } },
    ]);

    // 关联文档标题（文档数有限，内存 join 较聚合 lookup 更直观）
    const docIds = rows.map((r) => r._id).filter(Boolean);
    const docs = docIds.length
      ? await this.documentModel.find({ _id: { $in: docIds } }).exec()
      : [];
    const titleMap = new Map(docs.map((d) => [String(d._id), d.title]));

    return rows
      .filter((r) => r._id)
      .map((r) => ({
        documentId: String(r._id),
        title: titleMap.get(String(r._id)) ?? '（已删除）',
        questionCount: r.questionCount,
        lastAskedAt: r.lastAskedAt,
      }));
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

    // F-07 修复：复用 DocumentProcessorService.extractText 正确解析 PDF（pdf-parse），
    // 避免早期 readFileSync(utf-8) 读 PDF 二进制导致的乱码
    const content = await this.documentProcessorService.extractText(doc.filePath, doc.fileType);
    const fileContent = content.text.slice(0, 8000); // 取前 8000 字符控制 token 用量

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

  /**
   * 段落级摘要（F-13，POST /api/documents/:id/summary）
   *
   * 按页码范围 [startPage, endPage] 截取文档内容生成局部摘要，
   * 实现 PRD US-6 / F-13 验收"可选择目标段落生成局部摘要"。
   * - 仅 PDF 有页码概念（extractText 返回 content.pages）；非 PDF 退化为全文摘要。
   * - 页码越界校验：startPage/endPage 须在 [1, 总页数] 范围内且 start ≤ end。
   * - 权限校验复用 canViewSummary；记录 SUMMARIZE 审计（filterCondition 含页范围）。
   */
  async summarizeRange(
    id: string,
    dto: SummarizeRangeDto,
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

    // 复用统一解析（含逐页 pages，F-07 修复 + F-P04 精确页码）
    const content = await this.documentProcessorService.extractText(doc.filePath, doc.fileType);

    // 确定要摘要的文本范围
    let rangeText: string;
    let rangeDesc: string;
    if (content.pages && content.pages.length > 0) {
      // PDF：按页码范围截取
      const totalPages = content.pages.length;
      const start = dto.startPage ?? 1;
      const end = dto.endPage ?? totalPages;
      if (start < 1 || end < 1 || start > totalPages || end > totalPages || start > end) {
        throw new HttpException(
          `页码范围无效，文档共 ${totalPages} 页`,
          HttpStatus.BAD_REQUEST,
        );
      }
      rangeText = content.pages
        .filter((p) => p.num >= start && p.num <= end)
        .map((p) => `【第${p.num}页】\n${p.text}`)
        .join('\n\n')
        .slice(0, 8000); // 控制 token 用量
      rangeDesc = `第${start}-${end}页`;
    } else {
      // 非 PDF（TXT/MD/DOCX 无页码概念）：退化为全文摘要
      rangeText = content.text.slice(0, 8000);
      rangeDesc = '全文';
    }

    const systemPrompt = `你是一个专业的文档摘要生成器。请用 200 字以内的简洁中文总结以下文档内容。
只输出摘要文本，不要添加额外说明。`;
    const summary = await this.llmService.ask(
      systemPrompt,
      `文档标题：${doc.title}\n\n文档内容（${rangeDesc}）：\n${rangeText}`,
    );

    await this.auditService.record({
      user,
      action: AuditAction.SUMMARIZE,
      resource: 'document',
      resourceId: String(doc._id),
      filterCondition: { range: rangeDesc, startPage: dto.startPage, endPage: dto.endPage },
    });

    return { summary, documentTitle: doc.title };
  }

  /**
   * 调整文档保密级别/部门并重新索引（§8.5）
   *
   * 流程：更新 MongoDB 的 securityLevel/department → 删除旧向量索引
   * → 异步重跑处理流水线（用新 metadata 重新分块/向量化/入库）。
   * 返回更新后的文档信息（status 回到 uploaded/parsing）。
   */
  async updateSecurity(
    id: string,
    dto: UpdateDocumentSecurityDto,
    user: UserContext,
  ): Promise<DocumentResponse> {
    const doc = await this.documentModel.findById(id).exec();
    if (!doc) {
      throw new HttpException('文档不存在', HttpStatus.NOT_FOUND);
    }
    if (!doc.filePath || !existsSync(doc.filePath)) {
      throw new HttpException('文档文件不可用，无法重新索引', HttpStatus.BAD_REQUEST);
    }

    const newLevel = dto.securityLevel;
    const newDepartment = dto.department ?? 'all';

    // 1. 更新 MongoDB 字段 + 状态回到 uploaded
    doc.securityLevel = newLevel as any;
    doc.department = newDepartment;
    doc.status = DocumentStatus.UPLOADED;
    doc.errorMessage = undefined;
    doc.chunkCount = 0;
    await doc.save();

    // 2. 删除旧向量索引
    try {
      await this.vectorStoreService.deleteByDocumentId(id);
    } catch (err) {
      this.logger.warn(`[${id}] 重索引前删除旧向量失败（忽略）：${err}`);
    }

    // 3. 异步重跑处理流水线
    void this.processAsync(
      id,
      doc.filePath,
      doc.fileType,
      newLevel,
      newDepartment,
      doc.title,
    );

    await this.auditService.record({
      user,
      action: AuditAction.UPLOAD,
      resource: 'document',
      resourceId: id,
      filterCondition: { securityLevel: newLevel, department: newDepartment, reindex: true },
    });

    this.logger.log(`[${id}] 文档保密级别调整为 ${newLevel}/${newDepartment}，触发重新索引`);
    return this.toResponse(doc);
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
