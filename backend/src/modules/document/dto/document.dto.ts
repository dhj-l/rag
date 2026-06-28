import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { SecurityLevel } from '../../../common/types/common.types';

/**
 * 文档上传 DTO（§3.6 POST /api/documents/upload）
 *
 * 注意：文件本身通过 multipart 的 file 字段上传（@UploadedFile），
 * 此 DTO 仅描述表单中的文本字段。securityLevel 为 L2/L3 时 department 必填（§7.5）。
 */
export class UploadDocumentDto {
  /** 文档标题，必填非空 */
  @IsString()
  @IsNotEmpty({ message: '文档标题不能为空' })
  title!: string;

  /** 保密级别 L1/L2/L3/L4；L2/L3 时 department 必填（§7.5） */
  @IsEnum(SecurityLevel, { message: '保密级别必须为 L1 / L2 / L3 / L4' })
  securityLevel!: SecurityLevel;

  /** 所属部门：L2/L3 必填具体部门名；L1/L4 留空时后端默认 'all'（§3.3） */
  // L2/L3 级别文档必须指定部门（§7.5）；L1/L4 默认 'all'
  @ValidateIf((o) => o.securityLevel === SecurityLevel.L2 || o.securityLevel === SecurityLevel.L3)
  @IsString()
  @IsNotEmpty({ message: 'L2/L3 级别文档必须指定所属部门' })
  department?: string;
}

/** 文档列表查询 DTO（§3.6 GET /api/documents） */
export class DocumentListQueryDto {
  /** 页码，默认 1，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  /** 每页条数，默认 20，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  pageSize?: number = 20;
}

/**
 * 调整文档保密级别/部门 DTO（§8.5 重索引）
 * securityLevel 变更或 department 变更均触发向量库清理 + 重新索引。
 */
export class UpdateDocumentSecurityDto {
  /** 新保密级别，必填；变更后触发向量库重索引（§8.5） */
  @IsEnum(SecurityLevel, { message: '保密级别必须为 L1 / L2 / L3 / L4' })
  securityLevel!: SecurityLevel;

  /** 新所属部门：L2/L3 必填；L1/L4 留空时默认 'all' */
  @ValidateIf((o) => o.securityLevel === SecurityLevel.L2 || o.securityLevel === SecurityLevel.L3)
  @IsString()
  @IsNotEmpty({ message: 'L2/L3 级别文档必须指定所属部门' })
  department?: string;
}

/**
 * 段落级摘要请求 DTO（F-13，POST /api/documents/:id/summary）
 *
 * 通过页码范围指定要生成摘要的段落区间（1-based，闭区间），
 * 实现"可选择目标段落生成局部摘要"（PRD US-6 / F-13 验收标准）。
 * 仅对 PDF 有效（其他格式无页码概念，将退化为全文摘要）。
 * startPage / endPage 均可选：都不传 → 全文；只传 startPage → 从该页到末页。
 */
export class SummarizeRangeDto {
  /** 起始页码（1-based），可选；不传默认从第 1 页 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'startPage 必须为整数' })
  @Min(1, { message: 'startPage 最小为 1' })
  startPage?: number;

  /** 结束页码（1-based），可选；不传默认到最后一页 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'endPage 必须为整数' })
  @Min(1, { message: 'endPage 最小为 1' })
  endPage?: number;
}
