import type { UserContext } from './common.types';

/**
 * Express 类型扩展：在 Request 上挂载已认证的用户上下文。
 *
 * JWT 守卫解析 token 后将 UserContext 写入 req.user，控制器通过 @CurrentUser() 取用。
 * 参考 ARCHITECTURE.md §3.1 UserContext、§3.4 JWT 结构。
 */
declare global {
  namespace Express {
    interface Request {
      user?: UserContext;
    }
  }
}

export {};
