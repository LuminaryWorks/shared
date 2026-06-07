import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { NativePalAdapter } from "../adapters/native.adapter";
import { StubBkIamPalAdapter } from "../adapters/stub-bkiam.adapter";
import { CompositePalAdapter } from "../adapters/composite.adapter";
import { PalService } from "../pal.service";
import {
  PAL_MODULE_OPTIONS,
  type PalModuleOptions,
  type PermissionAbstractionLayer,
} from "../types";

function createAdapter(options: PalModuleOptions): PermissionAbstractionLayer {
  switch (options.adapter) {
    case "native":
      if (!options.rbacPort) {
        throw new Error("PalModule: native adapter requires rbacPort");
      }
      return new NativePalAdapter(options.rbacPort);
    case "bkiam":
      return new StubBkIamPalAdapter();
    case "composite": {
      const types = options.compositeAdapters ?? ["native"];
      const children = types.map((type) =>
        createAdapter({ ...options, adapter: type, compositeAdapters: undefined }),
      );
      return new CompositePalAdapter(children);
    }
    default:
      throw new Error(`PalModule: unsupported adapter "${options.adapter}"`);
  }
}

@Module({})
export class PalModule {
  static forRoot(options: PalModuleOptions): DynamicModule {
    const adapterProvider: Provider = {
      provide: "PAL_ADAPTER",
      useFactory: () => createAdapter(options),
    };

    return {
      module: PalModule,
      providers: [
        { provide: PAL_MODULE_OPTIONS, useValue: options },
        adapterProvider,
        {
          provide: PalService,
          useFactory: (adapter: PermissionAbstractionLayer) => new PalService(adapter),
          inject: ["PAL_ADAPTER"],
        },
      ],
      exports: [PalService],
      global: true,
    };
  }
}
