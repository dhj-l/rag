import type { Config } from 'tailwindcss';

/**
 * Tailwind 配置（ARCHITECTURE.md §6.1 tailwindcss ^3.4 / §7.1 CSS 类名约定）
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 预留品牌色，T05 UI 细化时扩展
        brand: {
          DEFAULT: '#2563eb',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
