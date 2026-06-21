import { SetMetadata } from '@nestjs/common';
import { Role } from '../types/common.types';

/**
 * @Roles() 角色装饰器元数据 key
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles(...roles) 装饰器
 *
 * 标注接口所需角色，由 RolesGuard 校验。可作用于控制器类或方法（方法优先）。
 *
 * 用法：
 *   @Roles(Role.ADMIN)
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Delete('users/:id')
 *   remove(...) { ... }
 *
 * 参考 ARCHITECTURE.md T02 实现要点 2（RolesGuard + @Roles 接口级角色控制）。
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
