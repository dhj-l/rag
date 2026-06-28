import type { Config } from 'tailwindcss';
import { FONT_FAMILY_SANS, FONT_FAMILY_MONO } from './src/config/fonts';

/**
 * Tailwind 配置（ARCHITECTURE.md §6.1 tailwindcss ^3.4 / §7.1 CSS 类名约定）
 * 设计系统：沉静靛蓝（Indigo Professional）
 * - brand：indigo 色阶（主色，替换原 blue）
 * - accent：sky 色阶（辅色点缀）
 * - 阴影 token：soft / card / float，统一 elevation
 * - 字体：Inter + 中文系统字体回退（见 src/config/fonts.ts）
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // 主色：靛蓝（企业级、克制专业）
        brand: {
          DEFAULT: '#4f46e5',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        // 辅色：天蓝（用于强调、链接辅助、点缀）
        accent: {
          DEFAULT: '#0ea5e9',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
      },
      fontFamily: {
        sans: FONT_FAMILY_SANS.split(', '),
        mono: FONT_FAMILY_MONO.split(', '),
      },
      // 统一 elevation 阴影 scale
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        card: '0 1px 3px rgba(15, 23, 42, 0.05), 0 4px 12px rgba(15, 23, 42, 0.05)',
        float: '0 4px 16px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.06)',
      },
      keyframes: {
        'caret-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1s steps(2, start) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
