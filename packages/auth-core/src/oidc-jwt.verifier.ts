import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  DefaultRuntimeClaimsResolver,
  DEFAULT_OIDC_CLAIMS_PRESET,
  withClaimsMapping,
} from "./runtime/claims";
import type {
  ClaimsMapping,
  ClaimsPreset,
  LuminaryPrincipal,
  OidcDiscoveryDocument,
  RuntimeClaimsResolver,
  RuntimeIdentityProviderKind,
} from "./types";

export interface OidcJwtVerifierOptions {
  issuer: string;
  audience?: string | string[];
  jwksUri?: string;
  claimsMapping?: ClaimsMapping;
  claimsPreset?: ClaimsPreset;
  claimsResolver?: RuntimeClaimsResolver;
  providerKind?: RuntimeIdentityProviderKind;
}

export class OidcJwtVerifier {
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  private discovery?: OidcDiscoveryDocument;
  private readonly issuer: string;
  private readonly preset: ClaimsPreset;
  private readonly resolver: RuntimeClaimsResolver;
  private readonly providerKind: RuntimeIdentityProviderKind;

  constructor(private readonly options: OidcJwtVerifierOptions) {
    this.issuer = options.issuer.replace(/\/$/, "");
    this.preset = withClaimsMapping(
      options.claimsPreset ?? DEFAULT_OIDC_CLAIMS_PRESET,
      options.claimsMapping,
    );
    this.resolver = options.claimsResolver ?? new DefaultRuntimeClaimsResolver();
    this.providerKind = options.providerKind ?? "oidc";
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

  async verify(token: string): Promise<LuminaryPrincipal> {
    const jwks = await this.ensureJwks();

    const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      issuer: this.discovery?.issuer ?? this.issuer,
    };
    if (this.preset.jwtType) verifyOptions.typ = this.preset.jwtType;
    if (this.options.audience) {
      verifyOptions.audience = this.options.audience;
    }

    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, jwks, verifyOptions));
    } catch (first) {
      if (!this.preset.jwtType || !this.preset.allowMissingOrDifferentJwtType) {
        throw first;
      }
      // Provider preset explicitly permits the historical typ fallback.
      try {
        const opts = { ...verifyOptions };
        delete opts.typ;
        ({ payload } = await jwtVerify(token, jwks, opts));
      } catch {
        throw first;
      }
    }

    return this.resolver.resolve(payload as JWTPayload, {
      providerKind: this.providerKind,
      issuer: this.discovery?.issuer ?? this.issuer,
      preset: this.preset,
    });
  }
}
