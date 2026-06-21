/**
 * 公共类型定义（枚举、核心接口、常量）
 *
 * 架构参考：ARCHITECTURE.md §3.1 类图、§3.2 MongoDB Schema、§3.3 向量库 Metadata、
 *           §3.4 JWT 结构、§3.7 枚举、§3.8 权限矩阵、§7.2 错误处理。
 *
 * 本文件是后端所有模块共享的类型源头；前端 `frontend/src/types/index.ts` 须与之保持一致。
 */

// =============================================================================
// 枚举（§3.7）
// =============================================================================

/** 角色（§3.7 / §3.4 / §3.2 users） */
export enum Role {
  EMPLOYEE = 'employee', // 普通员工
  MANAGER = 'manager', // 部门主管
  CEO = 'ceo', // CEO / 高管
  ADMIN = 'admin', // 管理员
}

/** 保密级别（§3.7） */
export enum SecurityLevel {
  L1 = 'L1', // 全员公开
  L2 = 'L2', // 部门内部
  L3 = 'L3', // 保密
  L4 = 'L4', // 机密
}

/** 文档处理状态（§3.7 / §3.2 documents） */
export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PARSING = 'parsing',
  EMBEDDING = 'embedding',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** 文件类型（§3.7） */
export enum FileType {
  PDF = 'pdf',
  TXT = 'txt',
  MARKDOWN = 'markdown',
}

/** 消息角色（§3.7 / §3.2 messages） */
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

/** 用户状态（§3.7 / §3.2 users） */
export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

/** 审计操作类型（§3.2 audit_logs.action） */
export enum AuditAction {
  SEARCH = 'search',
  VIEW_DOCUMENT = 'view_document',
  SUMMARIZE = 'summarize',
  UPLOAD = 'upload',
  DELETE = 'delete',
  LOGIN = 'login',
  ROLE_CHANGE = 'role_change',
}

// =============================================================================
// 核心接口
// =============================================================================

/** 权限上下文（§3.1 类图 UserContext / §3.4 JWT payload 业务字段） */
export interface UserContext {
  userId: string;
  username: string;
  role: Role;
  departments: string[];
}

/** JWT 载荷（§3.4） */
export interface JwtPayload {
  sub: string; // 用户 ID（MongoDB ObjectId 字符串）
  username: string;
  role: Role;
  departments: string[];
  iat?: number; // 签发时间
  exp?: number; // 过期时间
}

/**
 * 向量库过滤条件（§3.8 buildVectorFilter 返回值）
 * - accessibleLevels: 该角色可访问的保密级别
 * - departments: 用户所属部门（用于 L2/L3 部门过滤）
 * - noRestriction: true 时不附加任何过滤条件（ADMIN / CEO 全库检索）
 */
export interface VectorFilter {
  accessibleLevels: SecurityLevel[];
  departments: string[];
  noRestriction: boolean;
}

/**
 * 文档（权限判断所需的最小结构，对应 §3.1 Document / §3.2 documents 集合）
 * PermissionService.canAccessDocument 仅使用 securityLevel + department。
 */
export interface Document {
  id: string;
  title: string;
  filename: string;
  fileType: FileType;
  fileSize: number;
  securityLevel: SecurityLevel;
  department: string; // L1/L4 为 'all'，L2/L3 为具体部门名（§3.3）
  status: DocumentStatus;
  chunkCount?: number;
  uploadedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** 来源引用（§3.2 messages.sources[] / §3.3 chunk metadata） */
export interface SourceReference {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  chunkIndex: number;
  page: number; // 仅 PDF，其他类型为 0
  securityLevel: SecurityLevel;
}

/** 统一响应格式（§7.2） */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

// =============================================================================
// 常量
// =============================================================================

/**
 * 角色 × 保密级别 权限矩阵（§3.8 ROLE_ACCESSIBLE_LEVELS）
 * 各角色可访问的保密级别。
 */
export const ROLE_ACCESSIBLE_LEVELS: Record<Role, SecurityLevel[]> = {
  [Role.EMPLOYEE]: [SecurityLevel.L1, SecurityLevel.L2],
  [Role.MANAGER]: [SecurityLevel.L1, SecurityLevel.L2, SecurityLevel.L3],
  [Role.CEO]: [SecurityLevel.L1, SecurityLevel.L2, SecurityLevel.L3, SecurityLevel.L4],
  [Role.ADMIN]: [SecurityLevel.L1, SecurityLevel.L2, SecurityLevel.L3, SecurityLevel.L4],
};

/** 最大文件大小：20MB（§7.5 / §7.4） */
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20971520

/** 审计日志 TTL：90 天（§3.2 audit_logs.expiresAt） */
export const AUDIT_LOG_TTL_DAYS = 90;
