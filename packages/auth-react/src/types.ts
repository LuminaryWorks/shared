export interface LuminaryIdpConfig {
  /**
   * OIDC issuer. Prefer Auth Gateway (`http://localhost:3010/oidc`) so products
   * stay IdP-agnostic; direct Logto issuer is OK for local MVP.
   */
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  scopes?: string;
  /** API resource indicator (access token `aud`) */
  audience?: string;
  /** localStorage key for access token */
  tokenStorageKey?: string;
}

export interface LuminaryAuthSession {
  accessToken: string;
  idToken?: string;
  expiresAt?: number;
  profile?: Record<string, unknown>;
}

export function isIdpConfigured(config: Partial<LuminaryIdpConfig>): config is LuminaryIdpConfig {
  return Boolean(config.issuer && config.clientId && config.redirectUri);
}

/** Resolve issuer from Auth Gateway base URL or direct IDP_ISSUER. */
export function resolveIssuer(env: Record<string, string | undefined>): string | undefined {
  const gateway = env.VITE_AUTH_GATEWAY_URL ?? env.PUBLIC_AUTH_GATEWAY_URL ?? env.AUTH_GATEWAY_URL;
  if (gateway) return `${gateway.replace(/\/$/, "")}/oidc`;
  return env.VITE_IDP_ISSUER ?? env.PUBLIC_IDP_ISSUER ?? env.IDP_ISSUER;
}

export function readIdpConfigFromEnv(env: Record<string, string | undefined>): Partial<LuminaryIdpConfig> {
  return {
    issuer: resolveIssuer(env),
    clientId: env.VITE_IDP_CLIENT_ID ?? env.PUBLIC_IDP_CLIENT_ID,
    redirectUri: env.VITE_IDP_REDIRECT_URI ?? env.PUBLIC_IDP_REDIRECT_URI ?? "",
    postLogoutRedirectUri: env.VITE_IDP_POST_LOGOUT_URI ?? env.PUBLIC_IDP_POST_LOGOUT_URI,
    scopes: env.VITE_IDP_SCOPES ?? env.PUBLIC_IDP_SCOPES ?? "openid profile email offline_access",
    audience: env.VITE_IDP_AUDIENCE ?? env.PUBLIC_IDP_AUDIENCE,
    tokenStorageKey: env.VITE_IDP_TOKEN_KEY ?? "luminary_access_token",
  };
}
