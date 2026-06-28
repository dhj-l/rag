import { defineStore } from 'pinia';
import { computed, watchEffect } from 'vue';
import { useStorage, usePreferredDark } from '@vueuse/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * 主题 Store（深色模式）
 * 依据 ui-ux-pro-max skill 的 dark-mode-pairing：三态（light / dark / auto），
 * auto 跟随系统偏好。状态持久化到 localStorage，挂载前由 index.html 内联脚本
 * 预置 <html class="dark"> 避免 FOUC。
 *
 * - isDark：解析后的实际深浅（auto → 系统）
 * - toggle：在 light / dark 间切换（auto 时按当前解析值切到对侧）
 */
const stored = useStorage<ThemeMode>('da-theme-mode', 'auto');
const systemDark = usePreferredDark();

export const useThemeStore = defineStore('theme', () => {
  const mode = stored;

  const isDark = computed(
    () => mode.value === 'dark' || (mode.value === 'auto' && systemDark.value),
  );

  // 同步 <html> 上的 dark 类（Tailwind darkMode: 'class' + antd 由 App.vue 算法驱动）
  watchEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', isDark.value);
  });

  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark';
  }

  function setMode(m: ThemeMode) {
    mode.value = m;
  }

  return { mode, isDark, toggle, setMode };
});
