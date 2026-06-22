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

  @Post()
  create(@CurrentUser() user: UserContext, @Body() dto: CreateSessionDto) {
    return this.sessionService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUser() user: UserContext, @Query() query: SessionListQueryDto) {
    return this.sessionService.findAll(user, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.sessionService.findOne(user, id);
  }

  @Patch(':id')
  rename(@CurrentUser() user: UserContext, @Param('id') id: string, @Body() dto: UpdateSessionDto) {
    return this.sessionService.rename(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: UserContext, @Param('id') id: string) {
    return this.sessionService.remove(user, id);
  }
}
