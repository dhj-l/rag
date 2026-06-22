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

  @Get()
  findAll(@Query() query: DocumentListQueryDto, @CurrentUser() user: UserContext) {
    return this.documentService.findAll(query, user);
  }

  @Get(':id/status')
  findStatus(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.findStatus(id, user);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.getSummary(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  updateSecurity(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentSecurityDto,
    @CurrentUser() user: UserContext,
  ) {
    return this.documentService.updateSecurity(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: UserContext) {
    return this.documentService.remove(id, user);
  }
}
