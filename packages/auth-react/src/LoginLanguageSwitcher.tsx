import { useEffect, useId, useRef, useState } from "react";
import {
  DEFAULT_LOGIN_LOCALES,
  normalizeLoginLocale,
  type LoginLocaleOption,
} from "./login-labels";
import styles from "./LoginLanguageSwitcher.module.scss";

export interface LoginLanguageSwitcherProps {
  locale: string;
  onChange: (locale: string) => void;
  locales?: readonly LoginLocaleOption[];
  /** Accessible name, e.g. "Language" / "语言". */
  label?: string;
  variant?: "default" | "onDark";
}

function GlobeIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="12" cy="12" rx="4" ry="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 12h18M5 8h14M5 16h14" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function LoginLanguageSwitcher({
  locale,
  onChange,
  locales = DEFAULT_LOGIN_LOCALES,
  label = "Language",
  variant = "default",
}: LoginLanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current =
    locales.find((item) => item.code === locale) ??
    locales.find((item) => normalizeLoginLocale(item.code) === normalizeLoginLocale(locale)) ??
    locales[0];

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
    <div className={styles.switch} ref={rootRef}>
      <button
        type="button"
        className={variant === "onDark" ? `${styles.trigger} ${styles.onDark}` : styles.trigger}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        <span>{current?.label ?? "English"}</span>
        <svg className={styles.caret} viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </button>
      {open ? (
        <ul className={styles.menu} id={menuId} role="listbox" aria-label={label}>
          {locales.map((item) => {
            const active = item.code === current?.code;
            return (
              <li key={item.code} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? `${styles.item} ${styles.itemActive}` : styles.item}
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
