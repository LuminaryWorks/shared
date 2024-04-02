export interface LuminaryIdpConfig {
  /** OIDC issuer, e.g. http://localhost:3001/oidc */
  issuer: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri?: string;
  scopes?: string;
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

export function readIdpConfigFromEnv(env: Record<string, string | undefined>): Partial<LuminaryIdpConfig> {
  return {
    issuer: env.VITE_IDP_ISSUER,
    clientId: env.VITE_IDP_CLIENT_ID,
    redirectUri: env.VITE_IDP_REDIRECT_URI ?? "",
    postLogoutRedirectUri: env.VITE_IDP_POST_LOGOUT_URI,
    scopes: env.VITE_IDP_SCOPES ?? "openid profile email offline_access",
    tokenStorageKey: env.VITE_IDP_TOKEN_KEY ?? "luminary_access_token",
  };
}
