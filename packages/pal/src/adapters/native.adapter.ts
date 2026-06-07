import type {
  NativeRbacPort,
  PalContext,
  PalSubject,
  PermissionAbstractionLayer,
  PermissionCode,
} from "../types";
import { toPermissionCode } from "../types";

/** 默认 adapter：委托各产品本地 RBAC 表 */
export class NativePalAdapter implements PermissionAbstractionLayer {
  constructor(private readonly rbac: NativeRbacPort) {}

  hasPermission(subject: PalSubject, ctx: PalContext): Promise<boolean> {
    return this.rbac.hasPermission(subject.userId, toPermissionCode(ctx));
  }

  listPermissions(subject: PalSubject): Promise<PermissionCode[]> {
    return this.rbac.listPermissions(subject.userId);
  }

  listRoles(subject: PalSubject): Promise<string[]> {
    return this.rbac.listRoles(subject.userId);
  }
}
