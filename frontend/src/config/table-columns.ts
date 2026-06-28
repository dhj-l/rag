import { h } from 'vue';
import { UserStatus } from '@/types';
import type { TableColumnsType } from 'ant-design-vue';

export const userTableColumns: TableColumnsType = [
  {
    title: '用户名',
    dataIndex: 'username',
    key: 'username',
    width: 140,
  },
  {
    title: '显示名',
    dataIndex: 'displayName',
    key: 'displayName',
    width: 120,
  },
  {
    title: '角色',
    dataIndex: 'role',
    key: 'role',
    width: 100,
  },
  {
    title: '部门',
    key: 'departments',
    width: 180,
  },
  {
    title: '状态',
    key: 'status',
    width: 80,
  },
  {
    title: '操作',
    key: 'actions',
    width: 220,
  },
];
