<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  type UserResponse,
} from '@/api/user';
import { DEPARTMENTS, ROLE_LABELS } from '@/constants';
import { Role, UserStatus } from '@/types';
import { createUserRules, departmentOptions } from '@/config/form-rules';
import { userTableColumns } from '@/config/table-columns';
import { PlusOutlined } from '@ant-design/icons-vue';
import type { FormInstance } from 'ant-design-vue';
import { message } from 'ant-design-vue';

const activeTab = ref<'users'>('users');

// ===== 用户管理 =====
const users = ref<UserResponse[]>([]);
const usersLoading = ref(false);
const showCreate = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({
  username: '',
  password: '',
  displayName: '',
  role: Role.EMPLOYEE,
  departments: [] as string[],
});

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ label, value }));

async function fetchUsers() {
  usersLoading.value = true;
  try {
    const result = await listUsers({ pageSize: 100 });
    users.value = result.list;
  } finally {
    usersLoading.value = false;
  }
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  try {
    await createUser({
      username: createForm.username,
      password: createForm.password,
      displayName: createForm.displayName,
      role: createForm.role,
      departments: createForm.departments,
    });
    showCreate.value = false;
    createForm.username = '';
    createForm.password = '';
    createForm.displayName = '';
    createForm.role = Role.EMPLOYEE;
    createForm.departments = [];
    createFormRef.value?.resetFields();
    await fetchUsers();
    message.success('用户创建成功');
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '创建失败');
  }
}

// 角色修改弹窗
const roleModal = reactive({
  visible: false,
  userId: '',
  username: '',
  role: Role.EMPLOYEE as string,
});

function openRoleModal(u: UserResponse) {
  roleModal.userId = u.id;
  roleModal.username = u.username;
  roleModal.role = u.role;
  roleModal.visible = true;
}

async function confirmRoleChange() {
  try {
    await updateUser(roleModal.userId, { role: roleModal.role as Role });
    roleModal.visible = false;
    await fetchUsers();
    message.success('角色已更新');
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '修改失败');
  }
}

// 部门修改弹窗
const deptModal = reactive({
  visible: false,
  userId: '',
  username: '',
  departments: [] as string[],
});

function openDeptModal(u: UserResponse) {
  deptModal.userId = u.id;
  deptModal.username = u.username;
  deptModal.departments = [...u.departments];
  deptModal.visible = true;
}

async function confirmDeptChange() {
  try {
    await updateUser(deptModal.userId, { departments: deptModal.departments });
    deptModal.visible = false;
    await fetchUsers();
    message.success('部门已更新');
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '修改失败');
  }
}

async function toggleStatus(u: UserResponse) {
  const next: 'active' | 'disabled' = u.status === 'active' ? 'disabled' : 'active';
  try {
    await updateUserStatus(u.id, next);
    await fetchUsers();
    message.success(next === 'active' ? '已启用' : '已禁用');
  } catch (err) {
    message.error((err as { message?: string })?.message ?? '操作失败');
  }
}

const tabItems = [{ key: 'users', label: '用户管理' }];

onMounted(fetchUsers);
</script>

<template>
  <div class="scrollbar-thin h-full overflow-y-auto bg-slate-50 p-6 dark:bg-slate-950">
    <div class="mx-auto max-w-5xl">
      <!-- 页面头 -->
      <div class="mb-5">
        <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100">管理后台</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">管理用户、权限与文档资源</p>
      </div>

      <a-tabs v-model:activeKey="activeTab" :items="tabItems" />

      <!-- 用户管理 -->
      <div
        v-if="activeTab === 'users'"
        class="rounded-xl border border-slate-200/70 bg-white p-4 shadow-soft dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-3 flex items-center justify-between">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
            用户列表
            <span class="font-normal text-slate-400 dark:text-slate-500">（{{ users.length }}）</span>
          </span>
          <a-button type="primary" size="small" @click="showCreate = !showCreate">
            <template #icon><PlusOutlined /></template>
            {{ showCreate ? '取消' : '创建用户' }}
          </a-button>
        </div>

        <!-- 创建表单 -->
        <a-card
          v-if="showCreate"
          size="small"
          :bordered="false"
          class="mb-4 bg-slate-50 dark:bg-slate-800/50"
        >
          <a-form
            ref="createFormRef"
            :model="createForm"
            :rules="createUserRules"
            :label-col="{ style: { width: '80px' } }"
            size="small"
          >
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item name="username" label="用户名">
                  <a-input v-model:value="createForm.username" placeholder="用户名" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item name="password" label="密码">
                  <a-input-password v-model:value="createForm.password" placeholder="密码（≥6位）" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item name="displayName" label="显示名">
                  <a-input v-model:value="createForm.displayName" placeholder="显示名" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item name="role" label="角色">
                  <a-select v-model:value="createForm.role" :options="roleOptions" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="部门">
              <a-select
                v-model:value="createForm.departments"
                mode="multiple"
                :options="departmentOptions"
                placeholder="可多选部门"
                style="width: 100%;"
              />
            </a-form-item>
            <a-form-item style="margin-bottom: 0;">
              <a-button type="primary" @click="submitCreate">创建</a-button>
            </a-form-item>
          </a-form>
        </a-card>

        <!-- 用户表格 -->
        <a-table
          :columns="userTableColumns"
          :data-source="users"
          :loading="usersLoading"
          :pagination="false"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <a-tag>{{ ROLE_LABELS[record.role] || record.role }}</a-tag>
            </template>
            <template v-else-if="column.key === 'departments'">
              <span class="text-xs text-slate-500 dark:text-slate-400">{{ record.departments.join('、') || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'active' ? 'green' : 'red'">
                {{ record.status === 'active' ? '启用' : '禁用' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space :size="4">
                <a-button type="link" size="small" @click="openRoleModal(record)">改角色</a-button>
                <a-button type="link" size="small" @click="openDeptModal(record)">改部门</a-button>
                <a-popconfirm
                  :title="record.status === 'active' ? '确定禁用该用户？' : '确定启用该用户？'"
                  ok-text="确认"
                  cancel-text="取消"
                  @confirm="toggleStatus(record)"
                >
                  <a-button type="link" size="small">
                    {{ record.status === 'active' ? '禁用' : '启用' }}
                  </a-button>
                </a-popconfirm>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- 角色修改弹窗 -->
    <a-modal
      v-model:open="roleModal.visible"
      title="修改角色"
      ok-text="确认"
      cancel-text="取消"
      @ok="confirmRoleChange"
    >
      <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">用户：{{ roleModal.username }}</p>
      <a-select v-model:value="roleModal.role" :options="roleOptions" style="width: 100%;" />
    </a-modal>

    <!-- 部门修改弹窗 -->
    <a-modal
      v-model:open="deptModal.visible"
      title="修改部门"
      ok-text="确认"
      cancel-text="取消"
      @ok="confirmDeptChange"
    >
      <p class="mb-3 text-sm text-slate-500 dark:text-slate-400">用户：{{ deptModal.username }}</p>
      <a-select
        v-model:value="deptModal.departments"
        mode="multiple"
        :options="departmentOptions"
        style="width: 100%;"
      />
    </a-modal>
  </div>
</template>
