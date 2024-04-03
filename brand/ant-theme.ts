/**
 * LuminaryWorks 生态统一 Ant Design 主题令牌。
 * 唯一来源：LuminaryWorks/shared/brand/ant-theme.ts
 * 各产品 Web（Ant Design）通过 ConfigProvider 复用，保证主色一致。
 *
 * 用法：
 *   import { luminaryAntTheme } from "<path>/brand/ant-theme";
 *   <ConfigProvider theme={luminaryAntTheme}>...</ConfigProvider>
 * 暗色：<ConfigProvider theme={{ ...luminaryAntTheme, algorithm: theme.darkAlgorithm }}>
 */
export const luminaryColors = {
  primary: "#1677ff",
  primaryHover: "#4593ff",
  primaryActive: "#0958d9",
  primaryLight: "#e6f0ff",
  accentCyan: "#18a0fb",
  accentMint: "#21d4a8",
  success: "#2dcb56",
  warning: "#ff9c01",
  danger: "#ea3636",
} as const;

export const luminaryAntTheme = {
  token: {
    colorPrimary: luminaryColors.primary,
    colorSuccess: luminaryColors.success,
    colorWarning: luminaryColors.warning,
    colorError: luminaryColors.danger,
    borderRadius: 8,
  },
} as const;
