import { SecurityLevel } from '@/types';

/**
 * 部门常量（PRD-increment §2.2，MVP 5 个部门）
 * 供文档上传表单与用户管理复用。
 */
export const DEPARTMENTS = ['投资部', '品牌部', '信息技术部', '人力资源部', '财务部'] as const;

/** 保密级别选项（含展示标签，§3.8 权限矩阵） */
export const SECURITY_LEVEL_OPTIONS: { value: SecurityLevel; label: string; hint: string }[] = [
  { value: SecurityLevel.L1, label: 'L1 公开', hint: '全员可见' },
  { value: SecurityLevel.L2, label: 'L2 部门内部', hint: '需指定部门' },
  { value: SecurityLevel.L3, label: 'L3 保密', hint: '主管/高管可见，需指定部门' },
  { value: SecurityLevel.L4, label: 'L4 机密', hint: '仅 CEO/管理员可见' },
];

/** 角色中文标签（§3.7） */
export const ROLE_LABELS: Record<string, string> = {
  employee: '普通员工',
  manager: '部门主管',
  ceo: 'CEO/高管',
  admin: '管理员',
};

/** 文档状态中文标签 + 徽章颜色（§3.7 DocumentStatus） */
export const DOCUMENT_STATUS_META: Record<
  string,
  { label: string; badge: string }
> = {
  uploaded: { label: '待处理', badge: 'bg-slate-100 text-slate-600' },
  parsing: { label: '解析中', badge: 'bg-blue-100 text-blue-700' },
  embedding: { label: '向量化中', badge: 'bg-indigo-100 text-indigo-700' },
  completed: { label: '已索引', badge: 'bg-green-100 text-green-700' },
  failed: { label: '失败', badge: 'bg-red-100 text-red-700' },
};
