"use client";

import { useEffect, useId, useRef, useState } from "react";

export type LanguageMenuItem = {
  code: string;
  shortLabel: string;
  fullLabel: string;
};

function GlobeIcon() {
  return (
    <svg
      className="lang-icon"
      viewBox="0 0 20 20"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <circle
        cx="10"
        cy="10"
        r="7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <ellipse
        cx="10"
        cy="10"
        rx="3.2"
        ry="7.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M3 10h14M4.2 6.5h11.6M4.2 13.5h11.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function LanguageMenu({
  locale,
  items,
  onChange,
  ariaLabel,
  tone = "default",
}: {
  locale: string;
  items: LanguageMenuItem[];
  onChange: (code: string) => void;
  ariaLabel: string;
  tone?: "default" | "onDark";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = items.find((item) => item.code === locale);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className={tone === "onDark" ? "lang-menu is-on-dark" : "lang-menu"}
      ref={rootRef}
    >
      <button
        type="button"
        className="plain-control lang-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        <span>{current?.shortLabel ?? ""}</span>
      </button>
      {open ? (
        <div id={menuId} className="lang-list" role="menu">
          {items.map((item) => (
            <button
              key={item.code}
              type="button"
              role="menuitemradio"
              aria-checked={item.code === locale}
              onClick={() => {
                onChange(item.code);
                setOpen(false);
              }}
            >
              <span>{item.fullLabel}</span>
              {item.code === locale ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
