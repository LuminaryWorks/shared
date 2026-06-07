import type {
  PalContext,
  PalSubject,
  PermissionAbstractionLayer,
  PermissionCode,
} from "../types";
import { toPermissionCode } from "../types";

/** 权限完全来自 IdP JWT claims（企业私有化零 Luminary RBAC） */
export class OidcClaimsPalAdapter implements PermissionAbstractionLayer {
  constructor(
    private readonly getClaims: (subject: PalSubject) => {
      permissions?: string[];
      roles?: string[];
    },
  ) {}

  async hasPermission(subject: PalSubject, ctx: PalContext): Promise<boolean> {
    const code = toPermissionCode(ctx);
    const { permissions } = this.getClaims(subject);
    return permissions?.includes(code) ?? false;
  }

  async listPermissions(subject: PalSubject): Promise<PermissionCode[]> {
    const { permissions } = this.getClaims(subject);
    return (permissions ?? []) as PermissionCode[];
  }

  async listRoles(subject: PalSubject): Promise<string[]> {
    const { roles } = this.getClaims(subject);
    return roles ?? subject.roles ?? [];
  }
}
