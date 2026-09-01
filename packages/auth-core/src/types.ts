export type IdentityMode = "logto" | "external_oidc" | "legacy";

export interface ClaimsMapping {
  roles?: string;
  permissions?: string;
  orgId?: string;
  appAccess?: string;
  name?: string;
  email?: string;
}

export interface LuminaryAuthModuleOptions {
  /** logto | external_oidc | legacy (HS256 dev) */
  mode?: IdentityMode;
  /**
   * IAM catalog id (`logto` default, `oidc`, reserved `zitadel`, `legacy`).
   * Ignored when `mode` is set. Maps onto a built-in runtime; does not ship
   * empty vendor adapters.
   */
  iamProvider?: string;
  /** OIDC issuer, e.g. http://localhost:3001/oidc */
  issuer?: string;
  /** API audience / resource indicator */
  audience?: string | string[];
  /** Override JWKS URI; default from OIDC discovery */
  jwksUri?: string;
  /** Required HS256 secret when mode=legacy. There is no built-in default. */
  legacyJwtSecret?: string;
  /** Namespace for legacy subjects; defaults to urn:luminaryworks:legacy. */
  legacyIssuer?: string;
  /** JWT claim paths for PAL / guards */
  claimsMapping?: ClaimsMapping;
  /**
   * Override the built-in runtime selected by mode. This is the extension
   * point for another identity provider; auth-core does not ship empty
   * provider-specific adapters.
   */
  runtimeProvider?: RuntimeIdentityProvider;
}

export interface LuminaryJwtPayload {
  sub: string;
  name?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  orgId?: string;
  organizationId?: string;
  appAccess?: string[];
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
}

export interface LuminaryAuthenticatedUser extends LuminaryPrincipal {
  /** Raw JWT for PAL oidc-claims adapter */
  rawToken?: string;
}

export type RuntimeIdentityProviderKind = "logto" | "oidc" | "legacy" | (string & {});

export interface ExternalIdentityKey {
  issuer: string;
  subject: string;
}

export interface LuminaryPrincipal extends LuminaryJwtPayload {
  /** Canonical OIDC subject. The legacy sub field is retained for compatibility. */
  subject: string;
  /** Canonical OIDC issuer. The legacy iss field is retained for compatibility. */
  issuer: string;
  /** Canonical organization identifier. The legacy orgId field is retained. */
  organizationId?: string;
  /** Product-entry grants carried by the identity token, not commercial entitlements. */
  appAccess?: string[];
  providerKind: RuntimeIdentityProviderKind;
  externalIdentityKey: ExternalIdentityKey;
}

export interface RuntimeIdentityProvider {
  readonly kind: RuntimeIdentityProviderKind;
  verifyToken(token: string): Promise<LuminaryPrincipal>;
}

export type RuntimeClaims = Readonly<Record<string, unknown>>;

export interface ClaimsPreset {
  readonly name: string;
  readonly mapping: Readonly<Required<ClaimsMapping>>;
  /** JOSE protected-header typ required by this provider, when applicable. */
  readonly jwtType?: string;
  /** Compatibility fallback for providers that historically omitted typ. */
  readonly allowMissingOrDifferentJwtType?: boolean;
}

export interface ClaimsResolutionContext {
  providerKind: RuntimeIdentityProviderKind;
  issuer: string;
  preset: ClaimsPreset;
}

export interface RuntimeClaimsResolver {
  resolve(claims: RuntimeClaims, context: ClaimsResolutionContext): LuminaryPrincipal;
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
