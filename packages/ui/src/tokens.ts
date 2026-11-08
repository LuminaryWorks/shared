/**
 * Colour values mirror `shared/brand/ant-theme.ts` and `shared/brand/tokens.css`.
 * Do not invent new brand colours here.
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

export const luminaryAntToken = {
  colorPrimary: luminaryColors.primary,
  colorSuccess: luminaryColors.success,
  colorWarning: luminaryColors.warning,
  colorError: luminaryColors.danger,
  borderRadius: 8,
} as const;
