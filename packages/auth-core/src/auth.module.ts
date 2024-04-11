import { type DynamicModule, Global, Module, type Type } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { LuminaryAuthService } from "./auth.service";
import { LuminaryJwtAuthGuard } from "./guards/luminary-jwt-auth.guard";
import { LUMINARY_AUTH_OPTIONS, type LuminaryAuthModuleOptions } from "./types";

export interface LuminaryAuthModuleAsyncOptions {
  imports?: Type<unknown>[] | DynamicModule[] | Promise<DynamicModule>[];
  inject?: unknown[];
  useFactory: (
    ...args: unknown[]
  ) => LuminaryAuthModuleOptions | Promise<LuminaryAuthModuleOptions>;
  /** When true, register LuminaryJwtAuthGuard as APP_GUARD */
  globalGuard?: boolean;
}

@Global()
@Module({})
export class LuminaryAuthModule {
  static forRoot(options: LuminaryAuthModuleOptions & { globalGuard?: boolean }): DynamicModule {
    const { globalGuard = true, ...authOptions } = options;
    const providers: unknown[] = [
      Reflector,
      { provide: LUMINARY_AUTH_OPTIONS, useValue: authOptions },
      LuminaryAuthService,
      LuminaryJwtAuthGuard,
    ];
    if (globalGuard) {
      providers.push({ provide: APP_GUARD, useClass: LuminaryJwtAuthGuard });
    }
    return {
      module: LuminaryAuthModule,
      providers: providers as DynamicModule["providers"],
      exports: [LuminaryAuthService, LuminaryJwtAuthGuard],
    };
  }

  /**
   * Async registration — read issuer/audience from ConfigService inside useFactory
   * so values come from .env after ConfigModule.forRoot runs (not at import time).
   */
  static forRootAsync(options: LuminaryAuthModuleAsyncOptions): DynamicModule {
    const providers: unknown[] = [
      Reflector,
      {
        provide: LUMINARY_AUTH_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      },
      LuminaryAuthService,
      LuminaryJwtAuthGuard,
    ];
    if (options.globalGuard) {
      providers.push({ provide: APP_GUARD, useClass: LuminaryJwtAuthGuard });
    }
    return {
      module: LuminaryAuthModule,
      imports: options.imports ?? [],
      providers: providers as DynamicModule["providers"],
      exports: [LuminaryAuthService, LuminaryJwtAuthGuard],
    };
  }
}
