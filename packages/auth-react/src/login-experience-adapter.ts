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

export type LoginExperienceProvider = "logto";

/**
 * Factory for built-in providers. Logto is intentionally the only built-in
 * adapter; products can supply their own adapter without shipping fake stubs.
 */
export function createLoginExperienceAdapter(
  provider: LoginExperienceProvider = "logto",
): LoginExperienceAdapter {
  switch (provider) {
    case "logto":
      return new LogtoExperienceAdapter();
  }
}

let defaultAdapter: LoginExperienceAdapter | undefined;

/** Resolve an explicit product adapter, or the backward-compatible Logto default. */
export function resolveLoginExperienceAdapter(
  adapter?: LoginExperienceAdapter | null,
): LoginExperienceAdapter {
  if (adapter) return adapter;
  defaultAdapter ??= createLoginExperienceAdapter();
  return defaultAdapter;
}
