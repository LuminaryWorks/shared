import type {
  PalContext,
  PalSubject,
  PermissionAbstractionLayer,
  PermissionCode,
} from "../types";

/** 链式 adapter：任一子 adapter 允许即通过（OR） */
export class CompositePalAdapter implements PermissionAbstractionLayer {
  constructor(private readonly adapters: PermissionAbstractionLayer[]) {}

  async hasPermission(subject: PalSubject, ctx: PalContext): Promise<boolean> {
    for (const adapter of this.adapters) {
      if (await adapter.hasPermission(subject, ctx)) {
        return true;
      }
    }
    return false;
  }

  async listPermissions(subject: PalSubject): Promise<PermissionCode[]> {
    const merged = new Set<PermissionCode>();
    for (const adapter of this.adapters) {
      const codes = await adapter.listPermissions(subject);
      for (const code of codes) {
        merged.add(code);
      }
    }
    return [...merged];
  }

  async listRoles(subject: PalSubject): Promise<string[]> {
    const merged = new Set<string>();
    for (const adapter of this.adapters) {
      const roles = await adapter.listRoles(subject);
      for (const role of roles) {
        merged.add(role);
      }
    }
    return [...merged];
  }
}
