import type {
  ClaimsMapping,
  ClaimsPreset,
  ClaimsResolutionContext,
  LuminaryPrincipal,
  RuntimeClaims,
  RuntimeClaimsResolver,
} from "../types";

const COMMON_CLAIMS_MAPPING: Readonly<Required<ClaimsMapping>> = Object.freeze({
  roles: "roles",
  permissions: "permissions",
  orgId: "org_id",
  appAccess: "app_access",
  name: "name",
  email: "email",
});

export const DEFAULT_OIDC_CLAIMS_PRESET: ClaimsPreset = Object.freeze({
  name: "oidc",
  mapping: COMMON_CLAIMS_MAPPING,
});

export const DEFAULT_LOGTO_CLAIMS_PRESET: ClaimsPreset = Object.freeze({
  name: "logto",
  mapping: COMMON_CLAIMS_MAPPING,
  jwtType: "at+jwt",
  // Preserve compatibility with Logto deployments that emit JWT or no typ.
  allowMissingOrDifferentJwtType: true,
});

export function withClaimsMapping(
  preset: ClaimsPreset,
  overrides?: ClaimsMapping,
): ClaimsPreset {
  if (!overrides) return preset;
  return {
    ...preset,
    mapping: {
      ...preset.mapping,
      ...overrides,
    },
  };
}

function readClaim(claims: RuntimeClaims, path: string): unknown {
  if (path in claims) return claims[path];
  const parts = path.split(".");
  let current: unknown = claims;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return undefined;
}

export class DefaultRuntimeClaimsResolver implements RuntimeClaimsResolver {
  resolve(claims: RuntimeClaims, context: ClaimsResolutionContext): LuminaryPrincipal {
    const sub = toOptionalString(claims.sub);
    if (!sub) throw new Error("JWT missing sub");

    const issuer = toOptionalString(claims.iss) ?? context.issuer;
    const mapping = context.preset.mapping;
    const aud = claims.aud;
    const organizationId = toOptionalString(readClaim(claims, mapping.orgId));

    return {
      sub,
      subject: sub,
      name: toOptionalString(readClaim(claims, mapping.name)),
      email: toOptionalString(readClaim(claims, mapping.email)),
      roles: toStringArray(readClaim(claims, mapping.roles)),
      permissions: toStringArray(readClaim(claims, mapping.permissions)),
      orgId: organizationId,
      organizationId,
      appAccess: toStringArray(readClaim(claims, mapping.appAccess)),
      iss: issuer,
      issuer,
      aud:
        typeof aud === "string" || (Array.isArray(aud) && aud.every((item) => typeof item === "string"))
          ? aud
          : undefined,
      exp: typeof claims.exp === "number" ? claims.exp : undefined,
      iat: typeof claims.iat === "number" ? claims.iat : undefined,
      providerKind: context.providerKind,
      externalIdentityKey: {
        issuer,
        subject: sub,
      },
    };
  }
}
