import type { Rule } from 'ant-design-vue/es/form';
import { SecurityLevel } from '@/types';
import { DEPARTMENTS } from '@/constants';

/** 登录表单验证规则 */
export const loginRules: Record<string, Rule[]> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度 2~32 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6~64 位', trigger: 'blur' },
  ],
};

/** 创建用户表单验证规则 */
export const createUserRules: Record<string, Rule[]> = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 32, message: '用户名长度 2~32 位', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 64, message: '密码长度 6~64 位', trigger: 'blur' },
  ],
  displayName: [
    { required: true, message: '请输入显示名', trigger: 'blur' },
    { max: 32, message: '显示名不超过 32 位', trigger: 'blur' },
  ],
  role: [
    { required: true, message: '请选择角色', trigger: 'change' },
  ],
};

/** 文档上传表单验证规则 */
export const uploadRules: Record<string, Rule[]> = {
  title: [
    { required: true, message: '请输入文档标题', trigger: 'blur' },
    { max: 128, message: '标题不超过 128 位', trigger: 'blur' },
  ],
  securityLevel: [
    { required: true, message: '请选择保密级别', trigger: 'change' },
  ],
};

/** 文档上传 -- 部门条件必填校验 */
export function departmentValidator(securityLevel: SecurityLevel): Rule[] {
  if (securityLevel === SecurityLevel.L2 || securityLevel === SecurityLevel.L3) {
    return [{ required: true, message: '请选择所属部门', trigger: 'change' }];
  }
  return [];
}

/** 用户部门选择器选项 */
export const departmentOptions = DEPARTMENTS.map((d) => ({ label: d, value: d }));
