import type { GlobalToken } from 'ant-design-vue/es/theme/interface';
import { FONT_FAMILY_SANS } from '@/config/fonts';

/**
 * ant-design-vue ConfigProvider 主题 token
 * 设计系统：沉静靛蓝（Indigo Professional）· Refined Premium
 * 依据 ui-ux-pro-max skill：将 brand(indigo) / accent(emerald) 映射到 antd，
 * 并提供 light / dark 双 token，由 App.vue 按 theme store 切换 algorithm。
 */

/** 浅色 token（默认） */
export const lightToken: Partial<GlobalToken> = {
  colorPrimary: '#4f46e5', // brand-600 indigo
  colorLink: '#4f46e5',
  colorLinkHover: '#4338ca',
  colorInfo: '#0ea5e9', // sky（信息色，独立于 accent）
  colorSuccess: '#059669', // accent-600 emerald
  colorWarning: '#d97706',
  colorError: '#dc2626',
  colorTextBase: '#0f172a',
  colorBgLayout: '#f1f5f9',
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  fontSize: 14,
  fontFamily: FONT_FAMILY_SANS,
  wireframe: false,
  controlHeight: 36,
};

/** 深色 token（darkAlgorithm 基础上的语义覆盖） */
export const darkToken: Partial<GlobalToken> = {
  colorPrimary: '#6366f1', // brand-500，深色下提亮一档保对比
  colorLink: '#818cf8',
  colorLinkHover: '#a5b4fc',
  colorInfo: '#38bdf8',
  colorSuccess: '#10b981', // accent-500
  colorWarning: '#f59e0b',
  colorError: '#f87171',
  colorTextBase: '#e2e8f0',
  colorBgLayout: '#020617', // slate-950
  colorBgContainer: '#0f172a', // slate-900
  colorBgElevated: '#1e293b', // slate-800
  colorBorder: '#1e293b',
  colorBorderSecondary: '#334155',
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  fontSize: 14,
  fontFamily: FONT_FAMILY_SANS,
  wireframe: false,
  controlHeight: 36,
};

/** 兼容旧引用（= 浅色） */
export const themeToken = lightToken;
