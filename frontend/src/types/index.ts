/**
 * 前端类型定义
 *
 * 与后端 backend/src/common/types/common.types.ts 保持一致（ARCHITECTURE.md §3.1/3.2/3.4/3.7/3.8/7.2）。
 * 后端枚举/接口变更时，本文件须同步更新。
 */

// =============================================================================
// 枚举（§3.7）
// =============================================================================

export enum Role {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  CEO = 'ceo',
  ADMIN = 'admin',
}

export enum SecurityLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  L4 = 'L4',
}

export enum DocumentStatus {
  UPLOADED = 'uploaded',
  PARSING = 'parsing',
  EMBEDDING = 'embedding',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum FileType {
  PDF = 'pdf',
  TXT = 'txt',
  MARKDOWN = 'markdown',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

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

/** 权限上下文 / 当前登录用户（§3.1 UserContext / §3.4 JWT） */
export interface UserContext {
  userId: string;
  username: string;
  role: Role;
  departments: string[];
}

/** JWT 载荷（§3.4） */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  departments: string[];
  iat?: number;
  exp?: number;
}

/** 向量库过滤条件（§3.8） */
export interface VectorFilter {
  accessibleLevels: SecurityLevel[];
  departments: string[];
  noRestriction: boolean;
}

/** 文档（§3.1 Document / §3.2 documents） */
export interface Document {
  id: string;
  title: string;
  filename: string;
  fileType: FileType;
  fileSize: number;
  securityLevel: SecurityLevel;
  department: string;
  status: DocumentStatus;
  chunkCount?: number;
  uploadedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 来源引用（§3.2 messages.sources[]） */
export interface SourceReference {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  chunkIndex: number;
  page: number;
  securityLevel: SecurityLevel;
}

/** 统一响应格式（§7.2） */
export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

/** SSE 事件类型（§1.6） */
export enum SSEEventType {
  TOKEN = 'token',
  SOURCES = 'sources',
  TOOL = 'tool',
  ERROR = 'error',
  DONE = 'done',
}

/** SSE 事件载荷联合（§1.6 SSE 事件类型设计） */
export type SSEEvent =
  | { type: SSEEventType.TOKEN; content: string }
  | { type: SSEEventType.SOURCES; data: SourceReference[] }
  | { type: SSEEventType.TOOL; name: string }
  | { type: SSEEventType.ERROR; message: string }
  | { type: SSEEventType.DONE };
