import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { authGate } from "./auth-gate";
import { HeadlessLoginPanel, type HeadlessLoginLabels } from "./HeadlessLoginPanel";
import type { LuminaryAuthSession, LuminaryIdpConfig } from "./types";

export interface ReauthOverlayProps {
  config: Partial<LuminaryIdpConfig>;
  productName: string;
  logoSrc?: string;
  labels?: HeadlessLoginLabels;
  returnUrl?: string;
  /** Brand accent forwarded to HeadlessLoginPanel (default `#3a84ff`). */
  themeColor?: string;
  /** Exchange OIDC token / persist product session, then AuthGate completes. */
  onOidcSession: (session: LuminaryAuthSession, returnUrl?: string) => Promise<void> | void;
  /** Optional custom body instead of HeadlessLoginPanel */
  children?: ReactNode;
  /** Allow dismiss → cancelReauth (default true for mid-session; false for hard gate). */
  dismissible?: boolean;
  onDismiss?: () => void;
}

/**
 * Full-viewport soft gate shown while AuthGate phase is `reauth` (or `refreshing` spinner).
 * Does not iframe the IdP — uses Headless panel + OIDC popup.
 */
export function ReauthOverlay({
  config,
  productName,
  logoSrc,
  labels,
  returnUrl,
  themeColor,
  onOidcSession,
  children,
  dismissible = true,
  onDismiss,
}: ReauthOverlayProps) {
  const snapshot = useSyncExternalStore(authGate.subscribe, authGate.getSnapshot, authGate.getSnapshot);

  if (snapshot.phase === "idle") return null;

  const resolvedReturnUrl =
    returnUrl ??
    (() => {
      if (typeof window === "undefined") return undefined;
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash || hash.startsWith("/login") || hash.startsWith("/auth/")) return undefined;
      return hash.startsWith("/") ? hash : `/${hash}`;
    })();

  const handleSession = async (session: LuminaryAuthSession, next?: string) => {
    await onOidcSession(session, next);
    authGate.completeReauth();
  };

  const handleCancel = () => {
    onDismiss?.();
    authGate.cancelReauth("cancelled");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={productName}
      style={backdropStyle}
      onClick={dismissible ? handleCancel : undefined}
    >
      <div style={centerStyle} onClick={(e) => e.stopPropagation()}>
        {snapshot.phase === "refreshing" ? (
          <div style={spinnerCardStyle}>
            <div style={spinnerStyle} />
            <p style={{ margin: 0, color: "#e8eef2" }}>Refreshing session…</p>
          </div>
        ) : children ? (
          children
        ) : (
          <HeadlessLoginPanel
            config={config}
            productName={productName}
            logoSrc={logoSrc}
            themeColor={themeColor}
            labels={{
              title: labels?.title ?? "Session expired",
              subtitle: labels?.subtitle ?? "Sign in again to keep working — this page will not reload.",
              ...labels,
            }}
            returnUrl={resolvedReturnUrl}
            mode="popup"
            showCancel={dismissible}
            onCancel={handleCancel}
            onOidcSession={handleSession}
          />
        )}
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background:
    "radial-gradient(1200px 600px at 20% 10%, rgba(56, 120, 150, 0.35), transparent 55%), rgba(10, 18, 24, 0.72)",
  backdropFilter: "blur(6px)",
};

const centerStyle: CSSProperties = {
  width: "min(100%, 420px)",
};

const spinnerCardStyle: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  gap: 14,
  padding: 28,
  borderRadius: 16,
  background: "rgba(20, 32, 40, 0.88)",
};

const spinnerStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "3px solid rgba(255,255,255,0.2)",
  borderTopColor: "#7ec8e3",
  animation: "luminary-auth-spin 0.8s linear infinite",
};

// Inject keyframes once
if (typeof document !== "undefined" && !document.getElementById("luminary-auth-spin-style")) {
  const style = document.createElement("style");
  style.id = "luminary-auth-spin-style";
  style.textContent = `@keyframes luminary-auth-spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(style);
}
