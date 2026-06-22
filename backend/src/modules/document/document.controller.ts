import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role, UserContext } from '../../common/types/common.types';
import { deriveFileType } from './document.service';
import { DocumentService } from './document.service';
import { DocumentListQueryDto, UpdateDocumentSecurityDto, UploadDocumentDto } from './dto/document.dto';

/**
 * Multer fileFilter：MIME + 扩展名双校验（§7.5）
 * 支持 .pdf / .txt / .md / .markdown
 */
const documentFileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const fileType = deriveFileType(file.originalname);
  const allowedMime = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/octet-stream', // 部分系统对 .md/.txt 的兜底 MIME
  ];
  if (fileType && allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new HttpException('不支持的文件类型，仅允许 pdf/txt/md/markdown', HttpStatus.BAD_REQUEST), false);
  }
};

/**
 * 文档管理控制器（§3.6 文档接口）
 * - upload / delete：仅 admin
 * - list / status / summary：全部已认证角色（按权限过滤 / 校验）
 */
@Controller('api/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * 上传文档（POST /api/documents/upload，admin）
   *
   * - 权限：admin。
   * - 请求：multipart/form-data
   *   - file：文件字段（pdf/txt/md/markdown，≤20MB，由 documentFileFilter 双校验）
   *   - 表单文本字段：UploadDocumentDto（title / securityLevel / department）
   * - 响应 data：`{ documentId, status }`，status 初始为 'uploaded'；HTTP 状态码 201。
   * - 副作用：写盘 → 记录 uploadedBy + UPLOAD 审计 → 异步触发解析/向量化流水线（不阻塞响应）。
   * - 错误：400 未收到文件 / 不支持的类型；413 超过 20MB。
   */
  @Post('upload')
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: documentFileFilter,
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentService.upload(file, dto, user);
  }

  /**
   * 文档列表（GET /api/documents，需登录）
   *
   * - 权限：需登录；按角色×保密级别权限矩阵过滤（PermissionService.buildMongoQuery），仅返回可访问文档。
   * - 查询参数：DocumentListQueryDto（page 默认 1、pageSize 默认 20）。
   * - 响应 data：`{ list: DocumentResponse[], total }`，按 createdAt 倒序（剥离 filePath）。
   */
  @Get()
  findAll(@Query() query: DocumentListQueryDto, @CurrentUser() user: UserContext) {
    return this.documentService.findAll(query, user);
  }

  /**
   * 查询文档索引状态（GET /api/documents/:id/status，需登录）
   *
   * - 权限：需登录；需对文档有访问权限（canAccessDocument），否则 403。
   * - 路径参数：id（文档 ObjectId）。
   * - 响应 data：`{ documentId, status, chunkCount?, errorMessage? }`，status 为 uploaded/parsing/embedding/completed/failed。
   * - 用途：上传后轮询索引进度。
   * - 错误：404 文档不存在；403 无权限。
   */
  @Get(':id/status')
  findStatus(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.findStatus(id, user);
  }

  /**
   * 获取文档摘要（GET /api/documents/:id/summary，需登录）
   *
   * - 权限：需登录；需对文档有摘要查看权限（canViewSummary），否则 403。
   * - 路径参数：id（文档 ObjectId）。
   * - 响应 data：`{ summary, documentTitle }`，summary 由 LlmService 直接生成（≤200 字，不经过 Agent）。
   * - 副作用：记录 SUMMARIZE 审计。
   * - 错误：404 文档不存在 / 文档文件不可用；403 无权限。
   */
  @Get(':id/summary')
  getSummary(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.getSummary(id, user);
  }

  /**
   * 调整文档保密级别/部门并重新索引（PATCH /api/documents/:id，admin）
   *
   * - 权限：admin。
   * - 路径参数：id（文档 ObjectId）。
   * - 请求体：UpdateDocumentSecurityDto（securityLevel 必填；L2/L3 时 department 必填）。
   * - 响应 data：DocumentResponse（status 回到 uploaded/parsing，触发重索引）。
   * - 副作用：更新 MongoDB 字段 → 删除旧向量索引 → 异步重跑处理流水线 → 记录 UPLOAD 审计（reindex:true）。
   * - 错误：404 文档不存在；400 文档文件不可用，无法重新索引。
   */
  @Patch(':id')
  @Roles(Role.ADMIN)
  updateSecurity(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentSecurityDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentService.updateSecurity(id, dto, user);
  }

  /**
   * 删除文档（DELETE /api/documents/:id，admin）
   *
   * - 权限：admin。
   * - 路径参数：id（文档 ObjectId）。
   * - 响应 data：null（删除成功无返回体）。
   * - 副作用：best-effort 删除文件 + 向量库索引 + MongoDB 记录，并记录 DELETE 审计。
   * - 错误：404 文档不存在。
   */
  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.remove(id, user);
  }
}
