import type { ReactNode } from "react";
import { LoginLanguageSwitcher } from "./LoginLanguageSwitcher";
import type { LoginLocaleOption } from "./login-labels";
import styles from "./LoginCanvas.module.scss";

export type LoginCanvasTone = "console" | "vista" | "data" | "edu";

export interface LoginCanvasProps {
  tone: LoginCanvasTone;
  locale: string;
  onLocaleChange: (locale: string) => void;
  locales?: readonly LoginLocaleOption[];
  languageLabel?: string;
  /** Full-width slot for split layouts (hero + card). Default centers a single card. */
  fill?: boolean;
  decor?: ReactNode;
  children: ReactNode;
}

export function LoginCanvas({
  tone,
  locale,
  onLocaleChange,
  locales,
  languageLabel,
  fill = false,
  decor,
  children,
}: LoginCanvasProps) {
  return (
    <div className={styles.canvas} data-tone={tone}>
      <div className={styles.grid} aria-hidden="true" />
      {decor ? <div className={styles.decor}>{decor}</div> : null}
      <div className={styles.lang}>
        <LoginLanguageSwitcher
          locale={locale}
          onChange={onLocaleChange}
          locales={locales}
          label={languageLabel}
          variant={tone === "console" || tone === "data" ? "onDark" : "default"}
        />
      </div>
      <div className={fill ? `${styles.slot} ${styles.slotFill}` : styles.slot}>{children}</div>
    </div>
  );
}
