<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  type UserResponse,
} from '@/api/user';
import { DEPARTMENTS, ROLE_LABELS } from '@/constants';
import { Role, UserStatus } from '@/types';
import DocumentUpload from '@/components/document/DocumentUpload.vue';
import DocumentList from '@/components/document/DocumentList.vue';

/**
 * 管理后台（§5.3 T05 要点7）
 * Tab：用户管理（创建/分配角色部门/启停）+ 文档管理（上传/删除/调整保密级别）
 */
type Tab = 'users' | 'documents';
const tab = ref<Tab>('users');

// ===== 用户管理 =====
const users = ref<UserResponse[]>([]);
const usersLoading = ref(false);
const showCreate = ref(false);
const createForm = ref({
  username: '',
  password: '',
  displayName: '',
  role: Role.EMPLOYEE,
  departments: [] as string[],
});
const createError = ref('');

async function fetchUsers() {
  usersLoading.value = true;
  try {
    const result = await listUsers({ pageSize: 100 });
    users.value = result.list;
  } finally {
    usersLoading.value = false;
  }
}

function toggleDept(dept: string) {
  const idx = createForm.value.departments.indexOf(dept);
  if (idx >= 0) createForm.value.departments.splice(idx, 1);
  else createForm.value.departments.push(dept);
}

async function submitCreate() {
  createError.value = '';
  if (!createForm.value.username || !createForm.value.password || !createForm.value.displayName) {
    createError.value = '请填写完整信息';
    return;
  }
  if (createForm.value.password.length < 6) {
    createError.value = '密码长度不能少于 6 位';
    return;
  }
  try {
    await createUser({
      username: createForm.value.username,
      password: createForm.value.password,
      displayName: createForm.value.displayName,
      role: createForm.value.role,
      departments: createForm.value.departments,
    });
    showCreate.value = false;
    createForm.value = { username: '', password: '', displayName: '', role: Role.EMPLOYEE, departments: [] };
    await fetchUsers();
  } catch (err) {
    createError.value = (err as { message?: string })?.message ?? '创建失败';
  }
}

async function changeRole(u: UserResponse) {
  const roles = Object.keys(ROLE_LABELS);
  const newRole = prompt(`选择角色：\n${roles.map((r) => `${r} - ${ROLE_LABELS[r]}`).join('\n')}`, u.role) as Role | null;
  if (!newRole || !ROLE_LABELS[newRole]) return;
  try {
    await updateUser(u.id, { role: newRole });
    await fetchUsers();
  } catch (err) {
    alert((err as { message?: string })?.message ?? '修改失败');
  }
}

async function changeDepts(u: UserResponse) {
  const input = prompt(
    `请输入部门（用逗号分隔，可选：${DEPARTMENTS.join('/')}）`,
    u.departments.join(','),
  );
  if (input === null) return;
  const depts = input.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  try {
    await updateUser(u.id, { departments: depts });
    await fetchUsers();
  } catch (err) {
    alert((err as { message?: string })?.message ?? '修改失败');
  }
}

async function toggleStatus(u: UserResponse) {
  const next: 'active' | 'disabled' = u.status === 'active' ? 'disabled' : 'active';
  try {
    await updateUserStatus(u.id, next);
    await fetchUsers();
  } catch (err) {
    alert((err as { message?: string })?.message ?? '操作失败');
  }
}

onMounted(fetchUsers);
</script>

<template>
  <div class="h-full overflow-y-auto bg-slate-50 p-4">
    <div class="mx-auto max-w-5xl">
      <!-- Tab -->
      <div class="mb-4 flex gap-1 border-b border-slate-200">
        <button
          class="border-b-2 px-4 py-2 text-sm font-medium"
          :class="tab === 'users' ? 'border-brand text-brand-600' : 'border-transparent text-slate-500'"
          @click="tab = 'users'"
        >
          用户管理
        </button>
        <button
          class="border-b-2 px-4 py-2 text-sm font-medium"
          :class="tab === 'documents' ? 'border-brand text-brand-600' : 'border-transparent text-slate-500'"
          @click="tab = 'documents'"
        >
          文档管理
        </button>
      </div>

      <!-- 用户管理 -->
      <div v-if="tab === 'users'">
        <div class="mb-3 flex justify-between">
          <h2 class="text-sm font-semibold text-slate-700">用户列表（{{ users.length }}）</h2>
          <button
            class="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            @click="showCreate = !showCreate"
          >
            {{ showCreate ? '取消' : '+ 创建用户' }}
          </button>
        </div>

        <!-- 创建表单 -->
        <div v-if="showCreate" class="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <div class="grid grid-cols-2 gap-3">
            <input v-model="createForm.username" placeholder="用户名" class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
            <input v-model="createForm.password" type="password" placeholder="密码（≥6位）" class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
            <input v-model="createForm.displayName" placeholder="显示名" class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand" />
            <select v-model="createForm.role" class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-brand">
              <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
            </select>
          </div>
          <div class="mt-3">
            <div class="mb-1 text-xs text-slate-600">部门（可多选）</div>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="d in DEPARTMENTS"
                :key="d"
                class="rounded-full border px-2.5 py-1 text-xs"
                :class="createForm.departments.includes(d) ? 'border-brand bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600'"
                @click="toggleDept(d)"
              >
                {{ d }}
              </button>
            </div>
          </div>
          <div v-if="createError" class="mt-2 text-xs text-red-500">{{ createError }}</div>
          <button class="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-700" @click="submitCreate">创建</button>
        </div>

        <!-- 用户表格 -->
        <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">用户名</th>
                <th class="px-3 py-2 text-left">显示名</th>
                <th class="px-3 py-2 text-left">角色</th>
                <th class="px-3 py-2 text-left">部门</th>
                <th class="px-3 py-2 text-left">状态</th>
                <th class="px-3 py-2 text-left">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="usersLoading">
                <td colspan="6" class="px-3 py-4 text-center text-xs text-slate-400">加载中…</td>
              </tr>
              <tr v-else-if="!users.length">
                <td colspan="6" class="px-3 py-4 text-center text-xs text-slate-400">暂无用户</td>
              </tr>
              <tr v-for="u in users" :key="u.id" class="text-slate-700">
                <td class="px-3 py-2 font-mono text-xs">{{ u.username }}</td>
                <td class="px-3 py-2">{{ u.displayName }}</td>
                <td class="px-3 py-2">
                  <span class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{{ ROLE_LABELS[u.role] || u.role }}</span>
                </td>
                <td class="px-3 py-2 text-xs text-slate-500">{{ u.departments.join('、') || '—' }}</td>
                <td class="px-3 py-2">
                  <span class="rounded px-1.5 py-0.5 text-xs" :class="u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                    {{ u.status === 'active' ? '启用' : '禁用' }}
                  </span>
                </td>
                <td class="px-3 py-2">
                  <div class="flex gap-2 text-xs">
                    <button class="text-brand-600 hover:underline" @click="changeRole(u)">改角色</button>
                    <button class="text-brand-600 hover:underline" @click="changeDepts(u)">改部门</button>
                    <button class="text-slate-500 hover:underline" @click="toggleStatus(u)">
                      {{ u.status === 'active' ? '禁用' : '启用' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 文档管理 -->
      <div v-else class="grid gap-4 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white">
          <DocumentUpload />
        </div>
        <div class="rounded-lg border border-slate-200 bg-white">
          <DocumentList admin />
        </div>
      </div>
    </div>
  </div>
</template>
