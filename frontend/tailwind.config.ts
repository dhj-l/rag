import type { Config } from 'tailwindcss';

/**
 * Tailwind 配置（ARCHITECTURE.md §6.1 tailwindcss ^3.4 / §7.1 CSS 类名约定）
 * T05 扩展：brand 色阶、打字光标动画。
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563eb',
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      keyframes: {
        'caret-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1s steps(2, start) infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
