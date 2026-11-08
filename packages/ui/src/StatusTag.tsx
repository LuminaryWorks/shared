"use client";

import { Tag } from "antd";
import type { ReactNode } from "react";

const TONE = {
  success: "success",
  warning: "warning",
  error: "error",
  default: "default",
  processing: "processing",
} as const;

export type StatusTone = keyof typeof TONE;

/** Status chip. Pass the visible label as `children` so the host owns the copy. */
export function StatusTag({
  tone = "default",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return <Tag color={TONE[tone]}>{children}</Tag>;
}
