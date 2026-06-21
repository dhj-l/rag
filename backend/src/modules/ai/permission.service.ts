import { Injectable } from '@nestjs/common';
import {
  Document,
  Role,
  SecurityLevel,
  UserContext,
  VectorFilter,
  ROLE_ACCESSIBLE_LEVELS,
} from '../../common/types/common.types';

/**
 * 权限服务（核心跨模块服务）
 *
 * 架构级约束：所有涉及文档访问的入口都必须经过 PermissionService，
 * 绝不在业务代码中手写过滤逻辑（ARCHITECTURE.md §7.3 反模式）。
 *
 * 权限矩阵见 §3.8：
 *   employee → L1, L2          （需部门过滤）
 *   manager  → L1, L2, L3      （需部门过滤）
 *   ceo      → L1, L2, L3, L4  （无部门限制）
 *   admin    → L1, L2, L3, L4  （无部门限制，全库）
 *
 * 部门约定（§3.3）：L1/L4 的 department 为 'all'；L2/L3 为具体部门名。
 *
 * T01 阶段为纯逻辑实现（无外部依赖），便于单元测试；T03/T04 直接注入使用。
 */
@Injectable()
export class PermissionService {
  /** 该角色可访问的保密级别（§3.8 ROLE_ACCESSIBLE_LEVELS） */
  private getAccessibleLevels(role: Role): SecurityLevel[] {
    return ROLE_ACCESSIBLE_LEVELS[role] ?? [];
  }

  /** 是否需要部门过滤：employee / manager 需要，ceo / admin 不需要（§3.8） */
  needsDepartmentFilter(role: Role): boolean {
    return role === Role.EMPLOYEE || role === Role.MANAGER;
  }

  /**
   * 构建向量库过滤条件（§3.8 buildVectorFilter / §7.3）
   * 返回 VectorFilter，由 VectorStoreService 转换为 Chroma where 表达式。
   *
   * - noRestriction=true（admin/ceo）：向量检索不附加任何过滤。
   * - 其余角色：按 accessibleLevels + departments 过滤。
   */
  buildVectorFilter(user: UserContext): VectorFilter {
    const accessibleLevels = this.getAccessibleLevels(user.role);
    const noRestriction = !this.needsDepartmentFilter(user.role);
    return {
      accessibleLevels,
      departments: user.departments,
      noRestriction,
    };
  }

  /**
   * 构建 MongoDB 查询条件（§7.3 buildMongoQuery，用于文档列表）
   *
   * - admin/ceo：空对象（全库）。
   * - employee/manager：L1 全员可访问；L2/L3 需部门匹配（department ∈ 本部门 ∪ 'all'）。
   *   L4 对这两类角色不可访问，自然不在条件中。
   */
  buildMongoQuery(user: UserContext): Record<string, unknown> {
    if (!this.needsDepartmentFilter(user.role)) {
      return {};
    }

    const levels = this.getAccessibleLevels(user.role);
    const allLevels = levels.filter((l) => l === SecurityLevel.L1);
    const deptLevels = levels.filter((l) => l !== SecurityLevel.L1); // L2 / L3

    const orClauses: Record<string, unknown>[] = [];
    if (allLevels.length > 0) {
      orClauses.push({ securityLevel: { $in: allLevels } });
    }
    if (deptLevels.length > 0) {
      orClauses.push({
        securityLevel: { $in: deptLevels },
        department: { $in: [...user.departments, 'all'] },
      });
    }

    if (orClauses.length === 0) {
      // 无任何可访问级别（理论上不会发生），返回永不命中
      return { _id: null };
    }
    if (orClauses.length === 1) {
      return orClauses[0];
    }
    return { $or: orClauses };
  }

  /**
   * 是否可访问指定文档（§7.3，用于文档详情/摘要前的权限校验）
   *
   * 规则：
   * 1. doc.securityLevel 须在角色可访问级别内。
   * 2. 需部门过滤的角色，还需部门匹配（doc.department ∈ user.departments 或为 'all'）。
   */
  canAccessDocument(user: UserContext, doc: Document): boolean {
    const levels = this.getAccessibleLevels(user.role);
    if (!levels.includes(doc.securityLevel)) {
      return false;
    }
    if (!this.needsDepartmentFilter(user.role)) {
      return true; // ceo / admin
    }
    // L1/L4 的 department 为 'all'，直接放行；L2/L3 需部门匹配
    if (doc.department === 'all') {
      return true;
    }
    return user.departments.includes(doc.department);
  }

  /**
   * 是否可查看文档摘要（§3.1 类图 canViewSummary）
   * 当前与 canAccessDocument 同语义；独立方法以便后续按需差异化（如摘要单独的级别策略）。
   */
  canViewSummary(user: UserContext, doc: Document): boolean {
    return this.canAccessDocument(user, doc);
  }
}
