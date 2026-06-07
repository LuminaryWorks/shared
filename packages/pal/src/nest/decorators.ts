import { SetMetadata } from "@nestjs/common";
import { PAL_PERMISSION_KEY, type PalPermissionMetadata } from "../types";

export const RequirePalPermission = (resource: string, action: string) =>
  SetMetadata(PAL_PERMISSION_KEY, { resource, action } satisfies PalPermissionMetadata);
