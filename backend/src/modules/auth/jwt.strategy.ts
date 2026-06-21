import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload, UserContext } from '../../common/types/common.types';
import { AuthService } from './auth.service';

/**
 * JWT 策略（§3.4）
 *
 * - 从 Authorization: Bearer <token> 提取 JWT。
 * - validate() 验签后调 AuthService.validatePayload 确认用户有效，
 *   返回 UserContext 写入 req.user（供 @CurrentUser() 使用）。
 *
 * 注意：SSE 请求通过 URL query ?token=xxx 传递（EventSource 不支持自定义 Header），
 *      此处同时支持 query 参数（§3.4）。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: { query?: { token?: string } }) => req?.query?.token ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserContext> {
    try {
      return await this.authService.validatePayload(payload);
    } catch {
      throw new UnauthorizedException('登录已过期，请重新登录');
    }
  }
}
