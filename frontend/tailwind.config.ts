import type { Config } from 'tailwindcss';
import { FONT_FAMILY_SANS, FONT_FAMILY_MONO } from './src/config/fonts';

/**
 * Tailwind 配置（ARCHITECTURE.md §6.1 tailwindcss ^3.4 / §7.1 CSS 类名约定）
 * 设计系统：沉静靛蓝（Indigo Professional）· Refined Premium
 * 依据 ui-ux-pro-max skill 生成的 Data-Dense Dashboard 设计系统：
 * - brand：indigo 色阶（主色）
 * - accent：emerald 色阶（成功 / CTA 强调，替换原 sky）
 * - 阴影 token：soft / card / float / glow，统一 elevation
 * - 字体：Inter + Noto Sans SC（中文）+ 系统回退（见 src/config/fonts.ts）
 * - 深色模式：class 策略，由 stores/theme.ts 切换 <html class="dark">
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  darkMode: 'class',
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
        // 强调色：翡翠绿（用于成功态 / CTA / 流式指示，依据 skill 配色）
        accent: {
          DEFAULT: '#059669',
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
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
        // 主色聚焦辉光（用于流式状态点、聚焦环）
        glow: '0 0 0 4px rgba(99, 102, 241, 0.15)',
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
        // 骨架屏 shimmer：背景渐变横向滚动
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'caret-blink': 'caret-blink 1s steps(2, start) infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
