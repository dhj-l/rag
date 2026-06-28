<script setup lang="ts">
import { onMounted, computed, ref } from 'vue';
import { useSessionStore } from '@/stores/session';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MoreOutlined,
  MessageOutlined,
} from '@ant-design/icons-vue';
import type { Session } from '@/types';
import { message } from 'ant-design-vue';

const sessionStore = useSessionStore();

const sessions = computed(() => sessionStore.sessions);
const currentId = computed(() => sessionStore.current?.id);
const loading = computed(() => sessionStore.loading);

const renamingId = ref<string | null>(null);
const renameTitle = ref('');

async function createSession() {
  const s = await sessionStore.create();
  await sessionStore.select(s.id);
}

async function selectSession(id: string) {
  await sessionStore.select(id);
}

function startRename(s: Session) {
  renamingId.value = s.id;
  renameTitle.value = s.title;
}

async function confirmRename() {
  const id = renamingId.value;
  const title = renameTitle.value.trim();
  if (!id || !title) {
    renamingId.value = null;
    return;
  }
  await sessionStore.rename(id, title);
  renamingId.value = null;
}

async function removeSession(id: string) {
  await sessionStore.remove(id);
}

onMounted(() => {
  void sessionStore.fetchList();
});
</script>

<template>
  <div class="flex h-full flex-col bg-white dark:bg-slate-900">
    <!-- 栏头 -->
    <div class="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <MessageOutlined class="text-slate-400 dark:text-slate-500" />
        会话
      </span>
      <a-button type="primary" size="small" @click="createSession">
        <template #icon><PlusOutlined /></template>
        新建
      </a-button>
    </div>

    <!-- 列表 -->
    <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
      <a-spin
        v-if="loading && !sessions.length"
        :spinning="true"
        style="display: flex; justify-content: center; padding: 16px;"
      />

      <!-- 骨架屏（首次加载中且已有占位需求时由 loading 兜底，此处保留空状态） -->
      <div v-else-if="!sessions.length" class="flex flex-col items-center justify-center px-4 py-10 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          <MessageOutlined style="font-size: 20px;" />
        </div>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">暂无会话</p>
        <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">点击「新建」开始对话</p>
      </div>

      <a-list v-else :data-source="sessions" :split="false" size="small">
        <template #renderItem="{ item: s }">
          <a-list-item
            :class="[
              'group relative mb-0.5 cursor-pointer overflow-hidden rounded-lg px-3 py-2.5 transition-all duration-200',
              s.id === currentId
                ? 'bg-brand-50 dark:bg-brand-500/10'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800',
            ]"
            style="border: none; padding: 10px 12px;"
            @click="selectSession(s.id)"
          >
            <!-- 选中指示条 -->
            <span
              v-if="s.id === currentId"
              class="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-500"
            ></span>

            <template v-if="renamingId === s.id">
              <a-input
                v-model:value="renameTitle"
                size="small"
                style="flex: 1;"
                @press-enter="confirmRename"
                @blur="confirmRename"
              />
            </template>
            <template v-else>
              <a-list-item-meta>
                <template #title>
                  <span
                    :class="[
                      'block truncate text-sm font-medium',
                      s.id === currentId
                        ? 'text-brand-700 dark:text-brand-300'
                        : 'text-slate-700 dark:text-slate-200',
                    ]"
                  >
                    {{ s.title || '新会话' }}
                  </span>
                </template>
                <template #description>
                  <span class="text-[11px] text-slate-400 dark:text-slate-500">
                    {{ new Date(s.lastMessageAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) }}
                    {{ new Date(s.lastMessageAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}
                  </span>
                </template>
              </a-list-item-meta>
              <a-dropdown trigger="click" placement="bottomRight">
                <a-button
                  type="text"
                  size="small"
                  class="opacity-60 transition-opacity hover:opacity-100 group-hover:opacity-100"
                  @click.stop
                >
                  <MoreOutlined />
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item key="rename" @click.stop="startRename(s)">
                      <EditOutlined /><span class="ml-2">重命名</span>
                    </a-menu-item>
                    <a-popconfirm
                      title="确定删除该会话及其消息？"
                      ok-text="删除"
                      cancel-text="取消"
                      ok-type="danger"
                      @confirm="removeSession(s.id)"
                    >
                      <a-menu-item key="remove" danger @click.stop>
                        <DeleteOutlined /><span class="ml-2">删除</span>
                      </a-menu-item>
                    </a-popconfirm>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </div>
  </div>
</template>
