import type { GlobalToken } from 'ant-design-vue/es/theme/interface';
import { FONT_FAMILY_SANS } from '@/config/fonts';

/**
 * ant-design-vue ConfigProvider 主题 token
 * 设计系统：沉静靛蓝（Indigo Professional）
 * 将 Tailwind brand(indigo) / accent(sky) 色系映射到 antd 主题系统，
 * 保证 antd 组件与 Tailwind 类样式视觉一致。
 */
export const themeToken: Partial<GlobalToken> = {
  colorPrimary: '#4f46e5', // brand-600 indigo
  colorLink: '#4f46e5',
  colorLinkHover: '#4338ca',
  colorInfo: '#0ea5e9', // accent-500 sky
  colorSuccess: '#059669',
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
