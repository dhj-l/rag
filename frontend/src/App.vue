<script setup lang="ts">
import { computed } from 'vue';
import { ConfigProvider, theme as antdTheme } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { lightToken, darkToken } from '@/config/antd-theme';
import { useThemeStore } from '@/stores/theme';
import AppLayout from '@/components/layout/AppLayout.vue';

const themeStore = useThemeStore();

// 按 theme store 解析结果切换 antd algorithm + token
const configTheme = computed(() => ({
  algorithm: themeStore.isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  token: themeStore.isDark ? darkToken : lightToken,
}));
</script>

<template>
  <ConfigProvider :locale="zhCN" :theme="configTheme">
    <AppLayout>
      <RouterView />
    </AppLayout>
  </ConfigProvider>
</template>
