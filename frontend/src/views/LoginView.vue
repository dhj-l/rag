<script setup lang="ts">
import { reactive, ref, markRaw } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { loginRules } from '@/config/form-rules';
import type { FormInstance } from 'ant-design-vue';
import {
  ReadOutlined,
  UserOutlined,
  LockOutlined,
  SearchOutlined,
  SafetyOutlined,
  MessageOutlined,
} from '@ant-design/icons-vue';

const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const error = ref('');
const formRef = ref<FormInstance>();

const form = reactive({ username: '', password: '' });

// 品牌区特性
const features = [
  { icon: markRaw(SearchOutlined), text: '向量检索，精准定位文档相关段落' },
  { icon: markRaw(SafetyOutlined), text: '按保密级别与部门精细管控知识' },
  { icon: markRaw(MessageOutlined), text: '流式对话，实时展示引用来源' },
];

async function handleLogin(): Promise<void> {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  error.value = '';
  try {
    await authStore.login(form.username, form.password);
    router.push('/');
  } catch (err: unknown) {
    const e = err as { message?: string };
    error.value = e.message ?? '登录失败，请稍后重试';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen">
    <!-- 左：品牌展示区 -->
    <div
      class="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 text-white lg:flex"
    >
      <!-- 装饰光斑（极光感） -->
      <div
        class="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      ></div>
      <div
        class="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl"
      ></div>
      <!-- 网格纹理 -->
      <div
        class="pointer-events-none absolute inset-0 opacity-[0.08]"
        style="background-image: linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px); background-size: 40px 40px;"
      ></div>

      <!-- logo -->
      <div class="relative flex items-center gap-3">
        <div
          class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"
        >
          <ReadOutlined style="font-size: 22px;" />
        </div>
        <span class="text-lg font-semibold">智能文档助手</span>
      </div>

      <!-- 标语 + 特性 -->
      <div class="relative">
        <h1 class="text-4xl font-bold leading-tight">让企业知识<br />可对话、可检索</h1>
        <p class="mt-4 max-w-md text-brand-100">
          基于 RAG 的智能文档助手，上传资料后即可用自然语言提问，AI 精准定位段落并给出引用来源。
        </p>
        <ul class="mt-8 space-y-3">
          <li v-for="f in features" :key="f.text" class="flex items-center gap-3">
            <span
              class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 backdrop-blur"
            >
              <component :is="f.icon" />
            </span>
            <span class="text-sm text-brand-50">{{ f.text }}</span>
          </li>
        </ul>
      </div>

      <div class="relative text-xs text-brand-200">© 智能文档助手 · 企业知识库</div>
    </div>

    <!-- 右：登录表单 -->
    <div class="flex flex-1 items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div class="w-full max-w-sm">
        <!-- 移动端 logo -->
        <div class="mb-8 flex items-center gap-2.5 lg:hidden">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft"
          >
            <ReadOutlined style="font-size: 20px;" />
          </div>
          <span class="text-lg font-semibold text-slate-900 dark:text-slate-100">智能文档助手</span>
        </div>

        <!-- 登录卡片（premium 浮卡） -->
        <div
          class="rounded-2xl border border-slate-200/70 bg-white p-7 shadow-card dark:border-slate-800 dark:bg-slate-900"
        >
          <h2 class="text-2xl font-bold text-slate-900 dark:text-slate-100">欢迎回来</h2>
          <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">登录以继续使用文档助手</p>

          <a-form
            ref="formRef"
            :model="form"
            :rules="loginRules"
            layout="vertical"
            size="large"
            class="mt-7"
          >
            <a-form-item name="username">
              <a-input
                v-model:value="form.username"
                autocomplete="username"
                placeholder="请输入用户名"
              >
                <template #prefix><UserOutlined class="text-slate-400" /></template>
              </a-input>
            </a-form-item>

            <a-form-item name="password">
              <a-input-password
                v-model:value="form.password"
                autocomplete="current-password"
                placeholder="请输入密码"
              >
                <template #prefix><LockOutlined class="text-slate-400" /></template>
              </a-input-password>
            </a-form-item>

            <a-alert
              v-if="error"
              :message="error"
              type="error"
              show-icon
              style="margin-bottom: 16px;"
            />

            <a-form-item style="margin-bottom: 0;">
              <a-button
                type="primary"
                html-type="submit"
                :loading="loading"
                block
                size="large"
                @click="handleLogin"
              >
                {{ loading ? '登录中…' : '登录' }}
              </a-button>
            </a-form-item>
          </a-form>
        </div>
      </div>
    </div>
  </div>
</template>
