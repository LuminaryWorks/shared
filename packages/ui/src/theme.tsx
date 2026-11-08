"use client";

import { ConfigProvider, theme } from "antd";
import type { ThemeConfig } from "antd";
import type { ReactNode } from "react";
import { luminaryAntToken } from "./tokens";

export { luminaryAntToken, luminaryColors } from "./tokens";

/** Light theme object. Same token map as `shared/brand/ant-theme.ts`. */
export const luminaryAntTheme: ThemeConfig = {
  token: { ...luminaryAntToken },
};

export function luminaryAntThemeFor(mode: "light" | "dark" = "light"): ThemeConfig {
  if (mode === "dark") {
    return { ...luminaryAntTheme, algorithm: theme.darkAlgorithm };
  }
  return luminaryAntTheme;
}

export function ThemeProvider({
  mode = "light",
  children,
}: {
  mode?: "light" | "dark";
  children: ReactNode;
}) {
  return (
    <ConfigProvider theme={luminaryAntThemeFor(mode)}>{children}</ConfigProvider>
  );
}
