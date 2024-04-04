import { type DynamicModule, Global, Module } from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { LuminaryAuthService } from "./auth.service";
import { LuminaryJwtAuthGuard } from "./guards/luminary-jwt-auth.guard";
import { LUMINARY_AUTH_OPTIONS, type LuminaryAuthModuleOptions } from "./types";

@Global()
@Module({})
export class LuminaryAuthModule {
  static forRoot(options: LuminaryAuthModuleOptions): DynamicModule {
    return {
      module: LuminaryAuthModule,
      providers: [
        Reflector,
        { provide: LUMINARY_AUTH_OPTIONS, useValue: options },
        LuminaryAuthService,
        LuminaryJwtAuthGuard,
        {
          provide: APP_GUARD,
          useClass: LuminaryJwtAuthGuard,
        },
      ],
      exports: [LuminaryAuthService, LuminaryJwtAuthGuard],
    };
  }

  /** Register without global guard — use @UseGuards(LuminaryJwtAuthGuard) manually */
  static forRootAsync(options: LuminaryAuthModuleOptions): DynamicModule {
    return {
      module: LuminaryAuthModule,
      providers: [
        Reflector,
        { provide: LUMINARY_AUTH_OPTIONS, useValue: options },
        LuminaryAuthService,
        LuminaryJwtAuthGuard,
      ],
      exports: [LuminaryAuthService, LuminaryJwtAuthGuard],
    };
  }
}
