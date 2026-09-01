import { verifyLegacyJwt } from "../legacy-jwt.util";
import { OidcJwtVerifier } from "../oidc-jwt.verifier";
import { resolveIdentityMode } from "../iam-provider";
import type {
  LuminaryAuthModuleOptions,
  LuminaryPrincipal,
  RuntimeIdentityProvider,
} from "../types";
import { DEFAULT_LOGTO_CLAIMS_PRESET, DEFAULT_OIDC_CLAIMS_PRESET } from "./claims";

export const DEFAULT_LEGACY_ISSUER = "urn:luminaryworks:legacy";

export interface OidcRuntimeIdentityProviderOptions {
  issuer: string;
  audience?: string | string[];
  jwksUri?: string;
  claimsMapping?: LuminaryAuthModuleOptions["claimsMapping"];
}

export class OidcRuntimeIdentityProvider implements RuntimeIdentityProvider {
  readonly kind = "oidc";
  private readonly verifier: OidcJwtVerifier;

  constructor(options: OidcRuntimeIdentityProviderOptions) {
    this.verifier = new OidcJwtVerifier({
      ...options,
      claimsPreset: DEFAULT_OIDC_CLAIMS_PRESET,
      providerKind: this.kind,
    });
  }

  verifyToken(token: string): Promise<LuminaryPrincipal> {
    return this.verifier.verify(token);
  }
}

export class LogtoRuntimeIdentityProvider implements RuntimeIdentityProvider {
  readonly kind = "logto";
  private readonly verifier: OidcJwtVerifier;

  constructor(options: OidcRuntimeIdentityProviderOptions) {
    this.verifier = new OidcJwtVerifier({
      ...options,
      claimsPreset: DEFAULT_LOGTO_CLAIMS_PRESET,
      providerKind: this.kind,
    });
  }

  verifyToken(token: string): Promise<LuminaryPrincipal> {
    return this.verifier.verify(token);
  }
}

export class LegacyRuntimeIdentityProvider implements RuntimeIdentityProvider {
  readonly kind = "legacy";

  constructor(
    private readonly secret: string,
    private readonly issuer = DEFAULT_LEGACY_ISSUER,
  ) {}

  async verifyToken(token: string): Promise<LuminaryPrincipal> {
    const payload = verifyLegacyJwt(token, this.secret);
    if (!payload) throw new Error("Invalid or expired token");
    const issuer = payload.iss ?? this.issuer;
    const organizationId = payload.organizationId ?? payload.orgId;

    return {
      ...payload,
      sub: payload.sub,
      subject: payload.sub,
      iss: issuer,
      issuer,
      orgId: organizationId,
      organizationId,
      appAccess: payload.appAccess,
      providerKind: this.kind,
      externalIdentityKey: {
        issuer,
        subject: payload.sub,
      },
    };
  }
}

export function createRuntimeIdentityProvider(
  options: LuminaryAuthModuleOptions,
): RuntimeIdentityProvider {
  if (options.runtimeProvider) return options.runtimeProvider;

  const mode = resolveIdentityMode(options);
  if (mode === "legacy") {
    const secret = options.legacyJwtSecret?.trim();
    if (!secret || secret === "dev-change-me") {
      throw new Error(
        "mode=legacy requires an explicit legacyJwtSecret (do not use the old public default)",
      );
    }
    return new LegacyRuntimeIdentityProvider(secret, options.legacyIssuer);
  }

  if (!options.issuer) throw new Error("OIDC issuer not configured");
  const oidcOptions: OidcRuntimeIdentityProviderOptions = {
    issuer: options.issuer,
    audience: options.audience,
    jwksUri: options.jwksUri,
    claimsMapping: options.claimsMapping,
  };
  return mode === "logto"
    ? new LogtoRuntimeIdentityProvider(oidcOptions)
    : new OidcRuntimeIdentityProvider(oidcOptions);
}
