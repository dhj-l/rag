import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role, UserContext } from '../../common/types/common.types';
import { CreateUserDto, UpdateStatusDto, UpdateUserDto, UserListQueryDto } from './dto/user.dto';
import { UserService } from './user.service';

/**
 * 用户管理控制器（§3.6 用户管理接口）
 * 全部接口需 admin 角色。
 */
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 用户分页列表（GET /api/users，admin）
   *
   * - 权限：admin。
   * - 查询参数：UserListQueryDto（page 默认 1、pageSize 默认 20）。
   * - 响应 data：`{ list: UserResponse[], total }`，按 createdAt 倒序。
   */
  @Get()
  findAll(@Query() query: UserListQueryDto) {
    return this.userService.findAll(query);
  }

  /**
   * 创建用户（POST /api/users，admin）
   *
   * - 权限：admin。
   * - 请求体：CreateUserDto（username / password / displayName / role / departments）。
   * - 响应 data：UserResponse（不含密码），创建后状态默认 active。
   * - 副作用：记录 role_change 审计（operator + 新角色/部门）。
   * - 错误：409 用户名已存在。
   */
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() operator: UserContext) {
    return this.userService.create(dto, operator);
  }

  /**
   * 更新用户角色/部门（PATCH /api/users/:id，admin）
   *
   * - 权限：admin。
   * - 路径参数：id（用户 ObjectId）。
   * - 请求体：UpdateUserDto（role / departments，均可选）。
   * - 响应 data：UserResponse（更新后）。
   * - 副作用：记录 role_change 审计（before / after）。
   * - 错误：404 用户不存在。
   */
  @Patch(':id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() operator: UserContext) {
    return this.userService.updateRole(id, dto, operator);
  }

  /**
   * 启用/禁用用户（PATCH /api/users/:id/status，admin）
   *
   * - 权限：admin。
   * - 路径参数：id（用户 ObjectId）。
   * - 请求体：UpdateStatusDto（status：active / disabled）。
   * - 响应 data：UserResponse（更新后）。
   * - 副作用：记录 role_change 审计（before / after，§3.7 无独立 status 类型，归入 role_change）。
   * - 错误：404 用户不存在。
   */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() operator: UserContext,
  ) {
    return this.userService.updateStatus(id, dto.status, operator);
  }
}
