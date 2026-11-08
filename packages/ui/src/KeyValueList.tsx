"use client";

import { Descriptions } from "antd";
import type { ReactNode } from "react";

export function KeyValueList({
  items,
}: {
  items: { key: string; label: string; value: ReactNode }[];
}) {
  return (
    <Descriptions
      column={1}
      size="small"
      colon={false}
      items={items.map((item) => ({
        key: item.key,
        label: item.label,
        children: item.value,
      }))}
    />
  );
}
