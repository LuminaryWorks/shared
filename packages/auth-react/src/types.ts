export interface LuminaryIdpConfig {
  /**
   * OIDC issuer. Prefer Auth Gateway (`http://localhost:3010/oidc`) so products
   * stay IdP-agnostic; direct Logto issuer is OK for local MVP.
   */
  issuer: string;
  clientId: string;
  redirectUri: string;
  /**
   * Popup OIDC callback. Defaults to `redirectUri` (same `/auth/callback`).
   * Must be registered on the IdP application.
   */
  popupRedirectUri?: string;
  postLogoutRedirectUri?: string;
  scopes?: string;
  /** API resource indicator (access token `aud`) */
  audience?: string;
  /** localStorage key for access token */
  tokenStorageKey?: string;
  /**
   * Logto Experience API base (no trailing slash), e.g. Auth Gateway
   * `http://localhost:3010` or direct Logto `http://localhost:3001`.
   * When set, Headless password sign-in is attempted before OIDC popup fallback.
   */
  experienceApiBase?: string;
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
  // Prefer explicit IdP issuer so JWT `iss` validation matches Logto.
  // Auth Gateway is a CORS/proxy front — set via VITE_AUTH_EXPERIENCE_URL / VITE_AUTH_GATEWAY_URL.
  const explicit = env.VITE_IDP_ISSUER ?? env.PUBLIC_IDP_ISSUER ?? env.IDP_ISSUER;
  if (explicit) return explicit;
  const gateway = env.VITE_AUTH_GATEWAY_URL ?? env.PUBLIC_AUTH_GATEWAY_URL ?? env.AUTH_GATEWAY_URL;
  if (gateway) return `${gateway.replace(/\/$/, "")}/oidc`;
  return undefined;
}

/** Derive Experience API host from Gateway URL or by stripping `/oidc` from issuer. */
export function resolveExperienceApiBase(env: Record<string, string | undefined>): string | undefined {
  const explicit =
    env.VITE_AUTH_EXPERIENCE_URL ??
    env.PUBLIC_AUTH_EXPERIENCE_URL ??
    env.AUTH_EXPERIENCE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const gateway = env.VITE_AUTH_GATEWAY_URL ?? env.PUBLIC_AUTH_GATEWAY_URL ?? env.AUTH_GATEWAY_URL;
  if (gateway) return gateway.replace(/\/$/, "");

  const issuer = resolveIssuer(env);
  if (!issuer) return undefined;
  return issuer.replace(/\/$/, "").replace(/\/oidc$/i, "");
}

export function readIdpConfigFromEnv(env: Record<string, string | undefined>): Partial<LuminaryIdpConfig> {
  const redirectUri = env.VITE_IDP_REDIRECT_URI ?? env.PUBLIC_IDP_REDIRECT_URI ?? "";
  return {
    issuer: resolveIssuer(env),
    clientId: env.VITE_IDP_CLIENT_ID ?? env.PUBLIC_IDP_CLIENT_ID,
    redirectUri,
    popupRedirectUri: env.VITE_IDP_POPUP_REDIRECT_URI ?? env.PUBLIC_IDP_POPUP_REDIRECT_URI ?? redirectUri,
    postLogoutRedirectUri: env.VITE_IDP_POST_LOGOUT_URI ?? env.PUBLIC_IDP_POST_LOGOUT_URI,
    scopes: env.VITE_IDP_SCOPES ?? env.PUBLIC_IDP_SCOPES ?? "openid profile email offline_access",
    audience: env.VITE_IDP_AUDIENCE ?? env.PUBLIC_IDP_AUDIENCE,
    tokenStorageKey: env.VITE_IDP_TOKEN_KEY ?? "luminary_access_token",
    experienceApiBase: resolveExperienceApiBase(env),
  };
}
