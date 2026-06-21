import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserContext } from '../types/common.types';

/**
 * @CurrentUser() 参数装饰器
 *
 * 从已认证请求的 req.user 取出权限上下文（由 JwtAuthGuard 写入）。
 *
 * 用法：
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: UserContext) { ... }
 *
 * 参考 ARCHITECTURE.md §3.1 UserContext、common/types/express.d.ts
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext): UserContext | unknown => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as UserContext | undefined;
    return data ? user?.[data] : user;
  },
);
