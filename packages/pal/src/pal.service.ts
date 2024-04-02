import { Injectable } from "@nestjs/common";
import type {
  PalContext,
  PalSubject,
  PermissionAbstractionLayer,
  PermissionCode,
} from "./types";

@Injectable()
export class PalService implements PermissionAbstractionLayer {
  constructor(private readonly adapter: PermissionAbstractionLayer) {}

  hasPermission(subject: PalSubject, ctx: PalContext): Promise<boolean> {
    return this.adapter.hasPermission(subject, ctx);
  }

  listPermissions(subject: PalSubject): Promise<PermissionCode[]> {
    return this.adapter.listPermissions(subject);
  }

  listRoles(subject: PalSubject): Promise<string[]> {
    return this.adapter.listRoles(subject);
  }

  assignRoles?(subject: PalSubject, roleCodes: string[]): Promise<void> {
    if (!this.adapter.assignRoles) {
      return Promise.reject(new Error("Current PAL adapter does not support assignRoles"));
    }
    return this.adapter.assignRoles(subject, roleCodes);
  }
}
