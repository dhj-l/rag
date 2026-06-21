import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../types/common.types';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * 角色权限守卫
 *
 * 与 @Roles() 装饰器配合实现接口级角色控制：
 * - 未标注 @Roles() 的接口：放行（仅靠 JwtAuthGuard 保证已登录）。
 * - 标注 @Roles() 的接口：req.user.role 须在允许列表内，否则 403。
 * - req.user 缺失（未登录）：403。
 *
 * 用法：@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN)
 *
 * 参考 ARCHITECTURE.md T02 实现要点 2。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 未标注 @Roles()，无需角色校验
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('您没有权限执行此操作');
    }

    if (!requiredRoles.includes(user.role as Role)) {
      throw new ForbiddenException('您没有权限执行此操作');
    }

    return true;
  }
}
