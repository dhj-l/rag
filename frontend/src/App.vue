<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { themeToken } from '@/config/antd-theme';
import AppLayout from '@/components/layout/AppLayout.vue';
</script>

<template>
  <ConfigProvider :locale="zhCN" :theme="{ token: themeToken }">
    <AppLayout>
      <RouterView />
    </AppLayout>
  </ConfigProvider>
</template>
