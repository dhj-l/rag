import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 认证守卫
 *
 * 委托给注册名为 'jwt' 的 Passport 策略（JwtStrategy）完成真实验签与 req.user 注入。
 * 由 T01 占位骨架升级为 T02 真实实现（参考 ARCHITECTURE.md §3.4、T02 实现要点 1）。
 *
 * req.user 由 JwtStrategy.validate() 返回的 UserContext 填充，
 * 下游通过 @CurrentUser() 取用。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
