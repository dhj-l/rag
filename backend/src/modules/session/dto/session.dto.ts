import { Type } from 'class-transformer';
import { IsArray, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** 创建会话 DTO（§3.6 POST /api/sessions） */
export class CreateSessionDto {
  /** 会话标题，可选；为空时默认「新会话」，首条消息后自动取前 20 字命名 */
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '会话标题不能为空' })
  title?: string;

  /**
   * F-15 会话关联文档（多文档问答，可选）。
   * 传入则限定本会话检索范围到这些文档；关联时后端校验文档存在且用户有权访问
   * （PRD §2.3"仅可关联有权限的文档"）。
   */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: '关联文档 ID 格式不正确' })
  documentIds?: string[];
}

/** 重命名会话 DTO（§3.6 PATCH /api/sessions/:id） */
export class UpdateSessionDto {
  /** 新会话标题，必填非空 */
  @IsString()
  @IsNotEmpty({ message: '会话标题不能为空' })
  title!: string;

  /** F-15：更新会话关联文档（可选）；传入则替换原关联文档列表 */
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: '关联文档 ID 格式不正确' })
  documentIds?: string[];
}

/** 会话列表查询 DTO */
export class SessionListQueryDto {
  /** 页码，默认 1，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  /** 每页条数，默认 50，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  pageSize?: number = 50;
}
