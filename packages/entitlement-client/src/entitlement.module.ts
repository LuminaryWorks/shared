import {
  type CanActivate,
  type DynamicModule,
  type ExecutionContext,
  Injectable,
  Module,
  type Provider,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { EntitlementClient } from "./client";
import { EntitlementClientError } from "./errors";
import {
  ENTITLEMENT_CLIENT_OPTIONS,
  type EntitlementClientOptions,
} from "./types";

export const ENTITLEMENT_FEATURE_KEY = "entitlement:feature";
export const RequireEntitlement = (featureCode: string) =>
  SetMetadata(ENTITLEMENT_FEATURE_KEY, featureCode);

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly client: EntitlementClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureCode = this.reflector.getAllAndOverride<string>(ENTITLEMENT_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!featureCode) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { sub?: string; id?: string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const subjectId = req.user?.sub ?? req.user?.id;
    if (!subjectId) {
      throw new EntitlementClientError("UNAUTHORIZED", "Missing authenticated subject");
    }

    const productCode =
      (typeof req.headers["x-product-code"] === "string"
        ? req.headers["x-product-code"]
        : undefined) ?? process.env.PRODUCT_CODE;
    if (!productCode) {
      throw new EntitlementClientError(
        "VALIDATION_ERROR",
        "PRODUCT_CODE or X-Product-Code required for EntitlementGuard",
      );
    }

    if (this.client.mode === "off") return true;

    const results = await this.client.check({
      productCode,
      subjectId,
      features: [{ featureCode }],
    });
    const item = results[0];
    if (!item?.allowed) {
      throw new EntitlementClientError(
        (item?.reason as never) ?? "ENTITLEMENT_FEATURE_REQUIRED",
        item?.reason ?? "Feature not entitled",
        { productCode, featureCode },
      );
    }
    return true;
  }
}

@Module({})
export class EntitlementClientModule {
  static forRoot(options: EntitlementClientOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: ENTITLEMENT_CLIENT_OPTIONS, useValue: options },
      {
        provide: EntitlementClient,
        useFactory: (opts: EntitlementClientOptions) => new EntitlementClient(opts),
        inject: [ENTITLEMENT_CLIENT_OPTIONS],
      },
      EntitlementGuard,
      Reflector,
    ];
    return {
      module: EntitlementClientModule,
      global: true,
      providers,
      exports: [EntitlementClient, EntitlementGuard],
    };
  }

  static forRootAsync(opts: {
    useFactory: (...args: unknown[]) => EntitlementClientOptions | Promise<EntitlementClientOptions>;
    inject?: unknown[];
    imports?: DynamicModule["imports"];
  }): DynamicModule {
    return {
      module: EntitlementClientModule,
      global: true,
      imports: opts.imports,
      providers: [
        {
          provide: ENTITLEMENT_CLIENT_OPTIONS,
          useFactory: opts.useFactory,
          inject: (opts.inject ?? []) as never[],
        },
        {
          provide: EntitlementClient,
          useFactory: (o: EntitlementClientOptions) => new EntitlementClient(o),
          inject: [ENTITLEMENT_CLIENT_OPTIONS],
        },
        EntitlementGuard,
        Reflector,
      ],
      exports: [EntitlementClient, EntitlementGuard],
    };
  }
}
