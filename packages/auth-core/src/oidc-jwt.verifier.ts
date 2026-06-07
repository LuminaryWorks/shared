import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { LuminaryAuthModuleOptions, LuminaryJwtPayload, OidcDiscoveryDocument } from "./types";

function readClaim(payload: JWTPayload, path: string): unknown {
  if (path in payload) return payload[path];
  const parts = path.split(".");
  let current: unknown = payload;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(/[\s,]+/).filter(Boolean);
  return undefined;
}

export class OidcJwtVerifier {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private discovery?: OidcDiscoveryDocument;
  private readonly issuer: string;

  constructor(private readonly options: Required<Pick<LuminaryAuthModuleOptions, "issuer">> & LuminaryAuthModuleOptions) {
    this.issuer = options.issuer.replace(/\/$/, "");
  }

  private async ensureJwks(): Promise<ReturnType<typeof createRemoteJWKSet>> {
    if (this.jwks) return this.jwks;

    let jwksUri = this.options.jwksUri;
    if (!jwksUri) {
      this.discovery = await this.fetchDiscovery();
      jwksUri = this.discovery.jwks_uri;
    }

    this.jwks = createRemoteJWKSet(new URL(jwksUri));
    return this.jwks;
  }

  async fetchDiscovery(): Promise<OidcDiscoveryDocument> {
    if (this.discovery) return this.discovery;
    const url = `${this.issuer}/.well-known/openid-configuration`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OIDC discovery failed (${res.status}): ${url}`);
    }
    this.discovery = (await res.json()) as OidcDiscoveryDocument;
    return this.discovery;
  }

  async verify(token: string): Promise<LuminaryJwtPayload> {
    const jwks = await this.ensureJwks();
    const mapping = {
      roles: this.options.claimsMapping?.roles ?? "roles",
      permissions: this.options.claimsMapping?.permissions ?? "permissions",
      orgId: this.options.claimsMapping?.orgId ?? "org_id",
      name: this.options.claimsMapping?.name ?? "name",
      email: this.options.claimsMapping?.email ?? "email",
    };

    const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      issuer: this.discovery?.issuer ?? this.issuer,
    };
    if (this.options.audience) {
      verifyOptions.audience = this.options.audience;
    }

    const { payload } = await jwtVerify(token, jwks, verifyOptions);

    const sub = String(payload.sub ?? "");
    if (!sub) throw new Error("JWT missing sub");

    return {
      sub,
      name: readClaim(payload, mapping.name) as string | undefined,
      email: readClaim(payload, mapping.email) as string | undefined,
      roles: toStringArray(readClaim(payload, mapping.roles)),
      permissions: toStringArray(readClaim(payload, mapping.permissions)),
      orgId: readClaim(payload, mapping.orgId) as string | undefined,
      iss: payload.iss,
      aud: payload.aud,
      exp: payload.exp,
      iat: payload.iat,
    };
  }
}
