import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredSession,
  getCurrentUser,
  getStoredAccessToken,
  handleSignInCallback,
  signInPopup,
  signInRedirect,
  signOutRedirect,
} from "./oidc-client";
import { isIdpConfigured, readIdpConfigFromEnv, type LuminaryAuthSession, type LuminaryIdpConfig } from "./types";

interface LuminaryAuthContextValue {
  configured: boolean;
  session: LuminaryAuthSession | null;
  accessToken: string | null;
  loading: boolean;
  login: (returnUrl?: string) => Promise<void>;
  /** Popup OIDC — keeps the opener SPA mounted. */
  loginPopup: (returnUrl?: string) => Promise<LuminaryAuthSession>;
  logout: () => Promise<void>;
  completeCallback: () => Promise<{ returnUrl?: string }>;
  refreshSession: () => Promise<void>;
}

const LuminaryAuthContext = createContext<LuminaryAuthContextValue | null>(null);

export interface LuminaryAuthProviderProps {
  config?: Partial<LuminaryIdpConfig>;
  children: React.ReactNode;
}

export function LuminaryAuthProvider({ config: configProp, children }: LuminaryAuthProviderProps) {
  const config = useMemo(() => configProp ?? {}, [configProp]);
  const configured = isIdpConfigured(config);
  const [session, setSession] = useState<LuminaryAuthSession | null>(null);
  const [loading, setLoading] = useState(configured);

  const refreshSession = useCallback(async () => {
    if (!configured) {
      setSession(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const current = await getCurrentUser(config);
      setSession(current);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [config, configured]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(
    async (returnUrl?: string) => {
      if (!configured) throw new Error("IdP not configured");
      await signInRedirect(config, returnUrl);
    },
    [config, configured],
  );

  const loginPopup = useCallback(
    async (returnUrl?: string) => {
      if (!configured) throw new Error("IdP not configured");
      const { session: next } = await signInPopup(config, returnUrl);
      setSession(next);
      return next;
    },
    [config, configured],
  );

  const logout = useCallback(async () => {
    if (!configured) {
      clearStoredSession(config as LuminaryIdpConfig);
      setSession(null);
      return;
    }
    setSession(null);
    await signOutRedirect(config);
  }, [config, configured]);

  const completeCallback = useCallback(async () => {
    if (!configured) throw new Error("IdP not configured");
    const { session: next, returnUrl } = await handleSignInCallback(config);
    setSession(next);
    return { returnUrl };
  }, [config, configured]);

  const value = useMemo<LuminaryAuthContextValue>(
    () => ({
      configured,
      session,
      accessToken: session?.accessToken ?? (configured ? getStoredAccessToken(config) : null),
      loading,
      login,
      loginPopup,
      logout,
      completeCallback,
      refreshSession,
    }),
    [configured, session, loading, login, loginPopup, logout, completeCallback, refreshSession, config],
  );

  return <LuminaryAuthContext.Provider value={value}>{children}</LuminaryAuthContext.Provider>;
}

export function useLuminaryAuth(): LuminaryAuthContextValue {
  const ctx = useContext(LuminaryAuthContext);
  if (!ctx) throw new Error("useLuminaryAuth must be used within LuminaryAuthProvider");
  return ctx;
}

export { isIdpConfigured, readIdpConfigFromEnv };
export type { LuminaryAuthSession, LuminaryIdpConfig };
