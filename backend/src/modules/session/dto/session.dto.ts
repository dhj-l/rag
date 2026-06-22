import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

/** 创建会话 DTO（§3.6 POST /api/sessions） */
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '会话标题不能为空' })
  title?: string;
}

/** 重命名会话 DTO（§3.6 PATCH /api/sessions/:id） */
export class UpdateSessionDto {
  @IsString()
  @IsNotEmpty({ message: '会话标题不能为空' })
  title!: string;
}

/** 会话列表查询 DTO */
export class SessionListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  @Min(1, { message: 'page 最小为 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  @Min(1, { message: 'pageSize 最小为 1' })
  pageSize?: number = 50;
}
