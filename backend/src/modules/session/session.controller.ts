import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserContext } from '../../common/types/common.types';
import { SessionService } from './session.service';
import { CreateSessionDto, SessionListQueryDto, UpdateSessionDto } from './dto/session.dto';

/**
 * 会话管理控制器（§3.6 会话接口）
 * 全部接口需认证；会话隔离由 SessionService 保证（仅返回本人会话）。
 */
@Controller('api/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * 创建会话（POST /api/sessions，需登录）
   *
   * - 权限：需登录。
   * - 请求体：CreateSessionDto（title 可选，缺省为「新会话」）。
   * - 响应 data：SessionResponse（id / title / lastMessageAt / createdAt / updatedAt）。
   */
  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateSessionDto) {
    return this.sessionService.create(user, dto);
  }

  /**
   * 会话列表（GET /api/sessions，需登录）
   *
   * - 权限：需登录；仅返回本人会话（SessionService 隔离）。
   * - 查询参数：SessionListQueryDto（page 默认 1、pageSize 默认 50）。
   * - 响应 data：`{ list: SessionResponse[], total }`，按 updatedAt 倒序。
   */
  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: SessionListQueryDto) {
    return this.sessionService.findAll(user, query);
  }

  /**
   * 会话详情（GET /api/sessions/:id，需登录）
   *
   * - 权限：需登录；非本人会话返回 404（避免泄露存在性）。
   * - 路径参数：id（会话 ObjectId）。
   * - 响应 data：SessionDetailResponse（SessionResponse + messages[]，消息按 createdAt 升序）。
   * - 错误：404 会话不存在。
   */
  @Get(':id')
  findOne(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.sessionService.findOne(user, id);
  }

  /**
   * 重命名会话（PATCH /api/sessions/:id，需登录）
   *
   * - 权限：需登录；仅本人会话可改。
   * - 路径参数：id（会话 ObjectId）。
   * - 请求体：UpdateSessionDto（title，必填非空）。
   * - 响应 data：SessionResponse（更新后）。
   * - 错误：404 会话不存在。
   */
  @Patch(':id')
  rename(@CurrentUser() user: UserContext, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionService.rename(user, id, dto);
  }

  /**
   * 删除会话（DELETE /api/sessions/:id，需登录）
   *
   * - 权限：需登录；仅本人会话可删。
   * - 路径参数：id（会话 ObjectId）。
   * - 响应 data：null（删除成功无返回体）。
   * - 副作用：连带删除该会话下所有消息。
   * - 错误：404 会话不存在。
   */
  @Delete(':id')
  remove(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.sessionService.remove(user, id);
  }
}
