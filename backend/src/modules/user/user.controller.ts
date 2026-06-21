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

  @Get()
  findAll(@Query() query: UserListQueryDto) {
    return this.userService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() operator: UserContext) {
    return this.userService.create(dto, operator);
  }

  @Patch(':id')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() operator: UserContext) {
    return this.userService.updateRole(id, dto, operator);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() operator: UserContext,
  ) {
    return this.userService.updateStatus(id, dto.status, operator);
  }
}
