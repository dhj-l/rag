import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Role, UserStatus } from '../../../common/types/common.types';

/** 创建用户 DTO */
export class CreateUserDto {
  /** 登录用户名，全局唯一（409 冲突） */
  @IsString()
  username!: string;

  /** 明文密码，后端 bcrypt 哈希存储，长度 ≥ 6 */
  @IsString()
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password!: string;

  /** 显示名（昵称），用于界面展示 */
  @IsString()
  displayName!: string;

  /** 角色：employee / manager / ceo / admin */
  @IsEnum(Role, { message: '角色必须为 employee / manager / ceo / admin' })
  role!: Role;

  /** 所属部门数组，影响 L2/L3 文档访问范围 */
  @IsArray()
  @IsString({ each: true })
  departments!: string[];
}

/** 更新用户（角色/部门）DTO */
export class UpdateUserDto {
  /** 角色，可选；不传则不变 */
  @IsOptional()
  @IsEnum(Role, { message: '角色必须为 employee / manager / ceo / admin' })
  role?: Role;

  /** 所属部门数组，可选；不传则不变 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];
}

/** 启用/禁用用户 DTO */
export class UpdateStatusDto {
  /** 用户状态：active（启用）/ disabled（禁用） */
  @IsEnum(UserStatus, { message: '状态必须为 active / disabled' })
  status!: UserStatus;
}

/** 用户列表查询 DTO */
export class UserListQueryDto {
  /** 页码，默认 1，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  page?: number = 1;

  /** 每页条数，默认 20，最小 1 */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  pageSize?: number = 20;
}
