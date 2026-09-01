import { HostedOidcExperienceAdapter } from "./hosted-oidc-experience-adapter";
import { LogtoExperienceAdapter } from "./logto-experience-adapter";

/**
 * Capabilities exposed by a headless login-experience provider.
 *
 * Consumers can use these flags to avoid assuming that every provider supports
 * Logto's password, connector-discovery, or direct social-login flows.
 */
export const LOGIN_EXPERIENCE_CAPABILITIES = {
  passwordSignIn: "password-sign-in",
  socialConnectors: "social-connectors",
  socialDirectSignIn: "social-direct-sign-in",
} as const;

export type LoginExperienceCapability =
  (typeof LOGIN_EXPERIENCE_CAPABILITIES)[keyof typeof LOGIN_EXPERIENCE_CAPABILITIES];

export type ExperienceIdentifierType = "email" | "username" | "phone";

export interface ExperiencePasswordSignInInput {
  /** Experience API origin (no trailing slash). Prefer SPA origin when proxied. */
  apiBase: string;
  identifier: string;
  password: string;
  identifierType?: ExperienceIdentifierType;
  /** Required to bootstrap the OIDC interaction cookie before Experience calls. */
  issuer?: string;
  clientId?: string;
  redirectUri?: string;
  audience?: string;
  scopes?: string;
  /** Carried in OIDC state for post-login return (UserManager PKCE). */
  returnUrl?: string;
}

export interface ExperiencePasswordSignInResult {
  /** Continue URL from Experience submit (complete OIDC interaction). */
  redirectTo?: string;
  raw?: unknown;
}

export interface ExperienceSocialConnector {
  id: string;
  target: string;
  name: string;
  logo?: string;
}

export interface FetchSocialConnectorsInput {
  /** Same origin as Experience / IdP (e.g. SPA proxy or http://localhost:3001). */
  apiBase: string;
  appId?: string;
}

export interface SocialSignInRequest {
  /** Provider-specific authorize parameters, passed through by the OIDC client. */
  extraQueryParams?: Record<string, string>;
}

/**
 * Provider boundary for non-standard login-experience APIs.
 *
 * Standard OIDC redirect/popup and PKCE handling intentionally remain in the
 * OIDC client. Only provider-specific Experience operations belong here.
 */
export interface LoginExperienceAdapter {
  readonly provider: string;
  readonly capabilities: readonly LoginExperienceCapability[];
  experiencePasswordSignIn?(
    input: ExperiencePasswordSignInInput,
  ): Promise<ExperiencePasswordSignInResult>;
  fetchSocialConnectors?(
    input: FetchSocialConnectorsInput,
  ): Promise<ExperienceSocialConnector[]>;
  createSocialSignInRequest?(target: string): SocialSignInRequest;
}

export type LoginExperienceProvider = "logto" | "hosted" | "oidc" | "zitadel" | (string & {});

const HOSTED_LOGIN_PROVIDERS = new Set(["hosted", "oidc", "external_oidc", "zitadel"]);

function normalizeLoginExperienceProvider(provider: string): "logto" | "hosted" {
  const key = provider.trim().toLowerCase();
  if (!key || key === "logto") return "logto";
  if (HOSTED_LOGIN_PROVIDERS.has(key)) return "hosted";
  throw new Error(
    `Unknown login experience provider "${provider}". Shipped: logto (default). Hosted OIDC: oidc / hosted / zitadel.`,
  );
}

/**
 * Factory for built-in login adapters.
 *
 * - `logto`: Experience API Headless (password + social connectors)
 * - `hosted` / `oidc` / `zitadel`: standard OIDC Hosted Redirect (no empty vendor SDK)
 *
 * Products may still pass a custom `LoginExperienceAdapter`. Do not add stub
 * adapters for unintegrated Headless APIs.
 */
export function createLoginExperienceAdapter(
  provider: LoginExperienceProvider = "logto",
): LoginExperienceAdapter {
  const kind = normalizeLoginExperienceProvider(provider);
  if (kind === "logto") return new LogtoExperienceAdapter();
  return new HostedOidcExperienceAdapter(provider.trim().toLowerCase() || "hosted");
}

const adapterCache = new Map<string, LoginExperienceAdapter>();

/**
 * Resolve an explicit product adapter, or the catalog adapter for `iamProvider`.
 * Defaults to Logto for backward compatibility.
 */
export function resolveLoginExperienceAdapter(
  adapter?: LoginExperienceAdapter | null,
  iamProvider?: string | null,
): LoginExperienceAdapter {
  if (adapter) return adapter;
  const key = iamProvider?.trim() || "logto";
  const cached = adapterCache.get(key);
  if (cached) return cached;
  const created = createLoginExperienceAdapter(key);
  adapterCache.set(key, created);
  return created;
}

/** `VITE_IAM_PROVIDER` / `IAM_PROVIDER` / older `IDP_MODE`. */
export function resolveLoginExperienceProviderFromEnv(
  env: Record<string, string | undefined> = {},
): LoginExperienceProvider {
  return env.VITE_IAM_PROVIDER ?? env.PUBLIC_IAM_PROVIDER ?? env.IAM_PROVIDER ?? env.IDP_MODE ?? "logto";
}
