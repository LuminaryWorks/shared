import { Injectable, Inject, UnauthorizedException } from "@nestjs/common";
import { createRuntimeIdentityProvider } from "./runtime/providers";
import {
  LUMINARY_AUTH_OPTIONS,
  type LuminaryAuthModuleOptions,
  type LuminaryAuthenticatedUser,
  type LuminaryJwtPayload,
  type RuntimeIdentityProvider,
} from "./types";

@Injectable()
export class LuminaryAuthService {
  private runtimeProvider?: RuntimeIdentityProvider;

  constructor(
    @Inject(LUMINARY_AUTH_OPTIONS) private readonly options: LuminaryAuthModuleOptions,
  ) {}

  private get mode(): NonNullable<LuminaryAuthModuleOptions["mode"]> {
    if (this.options.mode) return this.options.mode;
    if (this.options.issuer) return "logto";
    return "legacy";
  }

  private getRuntimeProvider(): RuntimeIdentityProvider {
    if (!this.runtimeProvider) {
      this.runtimeProvider = createRuntimeIdentityProvider(this.options);
    }
    return this.runtimeProvider;
  }

  async verifyToken(token: string): Promise<LuminaryAuthenticatedUser> {
    try {
      const principal = await this.getRuntimeProvider().verifyToken(token);
      return { ...principal, rawToken: token };
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
    if (this.options.runtimeProvider) {
      return this.options.runtimeProvider.kind !== "legacy";
    }
    return this.mode !== "legacy";
  }
}

export type { LuminaryJwtPayload, LuminaryAuthenticatedUser };
