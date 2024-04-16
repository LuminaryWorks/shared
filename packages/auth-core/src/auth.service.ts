import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { OidcJwtVerifier } from "./oidc-jwt.verifier";
import { verifyLegacyJwt } from "./legacy-jwt.util";
import {
  LUMINARY_AUTH_OPTIONS,
  type LuminaryAuthModuleOptions,
  type LuminaryAuthenticatedUser,
  type LuminaryJwtPayload,
} from "./types";

@Injectable()
export class LuminaryAuthService {
  private oidcVerifier?: OidcJwtVerifier;

  constructor(
    @Inject(LUMINARY_AUTH_OPTIONS) private readonly options: LuminaryAuthModuleOptions,
  ) {}

  private get mode(): NonNullable<LuminaryAuthModuleOptions["mode"]> {
    if (this.options.mode) return this.options.mode;
    if (this.options.issuer) return "logto";
    return "legacy";
  }

  private getOidcVerifier(): OidcJwtVerifier {
    if (!this.options.issuer) {
      throw new UnauthorizedException("OIDC issuer not configured");
    }
    if (!this.oidcVerifier) {
      this.oidcVerifier = new OidcJwtVerifier({
        issuer: this.options.issuer,
        audience: this.options.audience,
        jwksUri: this.options.jwksUri,
        claimsMapping: this.options.claimsMapping,
      });
    }
    return this.oidcVerifier;
  }

  async verifyToken(token: string): Promise<LuminaryAuthenticatedUser> {
    const mode = this.mode;

    if (mode === "legacy") {
      const secret = this.options.legacyJwtSecret?.trim();
      if (!secret || secret === "dev-change-me") {
        throw new UnauthorizedException(
          "mode=legacy requires an explicit legacyJwtSecret (do not use the old public default)",
        );
      }
      const payload = verifyLegacyJwt(token, secret);
      if (!payload) throw new UnauthorizedException("Invalid or expired token");
      return { ...payload, rawToken: token };
    }

    // logto | external_oidc — same OIDC JWKS path
    try {
      const payload = await this.getOidcVerifier().verify(token);
      return { ...payload, rawToken: token };
    } catch (err) {
      const message = err instanceof Error ? err.message : "JWT verification failed";
      throw new UnauthorizedException(message);
    }
  }

  extractBearerToken(authorization?: string): string | undefined {
    if (!authorization?.startsWith("Bearer ")) return undefined;
    return authorization.slice(7);
  }

  isOidcMode(): boolean {
    return this.mode !== "legacy";
  }
}

export type { LuminaryJwtPayload, LuminaryAuthenticatedUser };
