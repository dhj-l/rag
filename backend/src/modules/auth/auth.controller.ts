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

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto, ip);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: UserContext) {
    return { userId: user.userId, username: user.username, role: user.role, departments: user.departments };
  }
}
