import { Body, Controller, Get, Ip, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserContext } from '../../common/types/common.types';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

/**
 * 认证控制器（§3.6 认证接口）
 *
 * - POST /api/auth/login：公开，登录返回 { token, user }。
 * - GET  /api/auth/profile：需登录，返回当前用户信息。
 */
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户登录（POST /api/auth/login，公开）
   *
   * - 权限：公开，无需 Authorization 头。
   * - 请求体：LoginDto（username / password）。
   * - 响应 data：`{ token, user }`，token 为 JWT（24h），user 为 UserResponse（不含密码）。
   * - 副作用：登录成功后记录 login 审计日志（含 IP）。
   * - 错误：401 用户名或密码错误；403 账号已被禁用。
   */
  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  /**
   * 获取当前登录用户信息（GET /api/auth/profile，需登录）
   *
   * - 权限：需登录（JwtAuthGuard）。
   * - 响应 data：`{ userId, username, role, departments }`（UserContext 业务字段子集）。
   * - 用途：前端刷新页面后恢复登录态 / 校验 token 是否有效。
   */
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: UserContext) {
    return { userId: user.userId, username: user.username, role: user.role, departments: user.departments };
  }
}
