"use client";

import { Typography } from "antd";
import { type ReactNode, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export const PAGE_HEADER_SLOT_ID = "page-header-slot";

export function PageHeader({
  title,
  lead,
  actions,
  slotId = PAGE_HEADER_SLOT_ID,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  slotId?: string;
}) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setSlot(document.getElementById(slotId));
  }, [slotId]);
  const header = (
    <div className="page-header">
      <div className="page-heading">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {lead ? (
          <Typography.Paragraph
            type="secondary"
            style={{ margin: "4px 0 0" }}
            ellipsis={{ rows: 2 }}
          >
            {lead}
          </Typography.Paragraph>
        ) : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
  if (!slot) return null;
  return createPortal(header, slot);
}
