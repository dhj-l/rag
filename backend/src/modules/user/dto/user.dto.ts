import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Role, UserStatus } from '../../../common/types/common.types';

/** 创建用户 DTO */
export class CreateUserDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(6, { message: '密码长度不能少于 6 位' })
  password!: string;

  @IsString()
  displayName!: string;

  @IsEnum(Role, { message: '角色必须为 employee / manager / ceo / admin' })
  role!: Role;

  @IsArray()
  @IsString({ each: true })
  departments!: string[];
}

/** 更新用户（角色/部门）DTO */
export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role, { message: '角色必须为 employee / manager / ceo / admin' })
  role?: Role;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departments?: string[];
}

/** 启用/禁用用户 DTO */
export class UpdateStatusDto {
  @IsEnum(UserStatus, { message: '状态必须为 active / disabled' })
  status!: UserStatus;
}

/** 用户列表查询 DTO */
export class UserListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page 必须为整数' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize 必须为整数' })
  pageSize?: number = 20;
}
