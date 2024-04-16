export type IdentityMode = "logto" | "external_oidc" | "legacy";

export interface LuminaryAuthModuleOptions {
  /** logto | external_oidc | legacy (HS256 dev) */
  mode?: IdentityMode;
  /** OIDC issuer, e.g. http://localhost:3001/oidc */
  issuer?: string;
  /** API audience / resource indicator */
  audience?: string | string[];
  /** Override JWKS URI; default from OIDC discovery */
  jwksUri?: string;
  /** Required HS256 secret when mode=legacy. There is no built-in default. */
  legacyJwtSecret?: string;
  /** JWT claim paths for PAL / guards */
  claimsMapping?: {
    roles?: string;
    permissions?: string;
    orgId?: string;
    name?: string;
    email?: string;
  };
}

export interface LuminaryJwtPayload {
  sub: string;
  name?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  orgId?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

export interface LuminaryAuthenticatedUser extends LuminaryJwtPayload {
  /** Raw JWT for PAL oidc-claims adapter */
  rawToken?: string;
}

export const LUMINARY_AUTH_OPTIONS = "LUMINARY_AUTH_OPTIONS";
export const LUMINARY_PUBLIC_KEY = "luminary:public";

export interface OidcDiscoveryDocument {
  issuer: string;
  jwks_uri: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
}
