import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { authGate, type AuthGateConfig, type AuthGateSnapshot } from "./auth-gate";
import { ReauthOverlay, type ReauthOverlayProps } from "./ReauthOverlay";
import type { LuminaryAuthSession, LuminaryIdpConfig } from "./types";

interface AuthGateContextValue {
  snapshot: AuthGateSnapshot;
  requestReauth: (message?: string) => Promise<"retry" | "fail">;
  completeReauth: () => void;
  cancelReauth: (message?: string) => void;
}

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export interface AuthGateProviderProps extends AuthGateConfig {
  children: ReactNode;
  /** When set, mounts {@link ReauthOverlay} automatically. */
  overlay?: Omit<ReauthOverlayProps, "onOidcSession"> & {
    onOidcSession: (session: LuminaryAuthSession, returnUrl?: string) => Promise<void> | void;
    config: Partial<LuminaryIdpConfig>;
  };
}

export function AuthGateProvider({
  children,
  tryRefresh,
  onReauthRequired,
  onSettled,
  overlay,
}: AuthGateProviderProps) {
  useEffect(() => {
    authGate.configure({ tryRefresh, onReauthRequired, onSettled });
  }, [tryRefresh, onReauthRequired, onSettled]);

  const snapshot = useSyncExternalStore(authGate.subscribe, authGate.getSnapshot, authGate.getSnapshot);

  const value = useMemo<AuthGateContextValue>(
    () => ({
      snapshot,
      requestReauth: (message?: string) => authGate.requestReauth(message),
      completeReauth: () => authGate.completeReauth(),
      cancelReauth: (message?: string) => authGate.cancelReauth(message),
    }),
    [snapshot],
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      {overlay ? <ReauthOverlay {...overlay} /> : null}
    </AuthGateContext.Provider>
  );
}

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within AuthGateProvider");
  return ctx;
}

/** Optional hook — returns null outside provider (for shared API helpers). */
export function useAuthGateOptional(): AuthGateContextValue | null {
  return useContext(AuthGateContext);
}
