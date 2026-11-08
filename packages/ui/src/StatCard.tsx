"use client";

import { Card, Typography } from "antd";
import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  extra,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  extra?: ReactNode;
}) {
  return (
    <Card>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Title level={3} style={{ margin: "8px 0 0" }}>
        {value}
      </Typography.Title>
      {hint ? (
        <Typography.Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
          {hint}
        </Typography.Paragraph>
      ) : null}
      {extra}
    </Card>
  );
}
