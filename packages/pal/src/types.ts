/** @see spec/contracts/pal.types.ts — keep in sync */

export interface PalSubject {
  userId: string;
  orgId?: string;
  roles?: string[];
}

export interface PalContext {
  resource: string;
  action: string;
  resourceId?: string;
}

export type PermissionCode = `${string}:${string}`;

export function toPermissionCode(ctx: PalContext): PermissionCode {
  return `${ctx.resource}:${ctx.action}`;
}

export function parsePermissionCode(code: PermissionCode): PalContext {
  const idx = code.indexOf(":");
  if (idx === -1) {
    throw new Error(`Invalid permission code: ${code}`);
  }
  return {
    resource: code.slice(0, idx),
    action: code.slice(idx + 1),
  };
}

export type PalAdapterType =
  | "native"
  | "logto"
  | "bkiam"
  | "ldap"
  | "oidc-claims"
  | "composite";

export interface PalConfig {
  adapter: PalAdapterType;
  cacheTtlSeconds?: number;
  compositeAdapters?: PalAdapterType[];
}

export interface PermissionAbstractionLayer {
  hasPermission(subject: PalSubject, ctx: PalContext): Promise<boolean>;
  listPermissions(subject: PalSubject): Promise<PermissionCode[]>;
  listRoles(subject: PalSubject): Promise<string[]>;
  assignRoles?(subject: PalSubject, roleCodes: string[]): Promise<void>;
}

/** 各产品 native adapter 需实现的 RBAC 端口 */
export interface NativeRbacPort {
  hasPermission(userId: string, permissionCode: PermissionCode): Promise<boolean>;
  listPermissions(userId: string): Promise<PermissionCode[]>;
  listRoles(userId: string): Promise<string[]>;
}

export const PAL_PERMISSION_KEY = "pal:permission";

export interface PalPermissionMetadata {
  resource: string;
  action: string;
}

export const PAL_MODULE_OPTIONS = "PAL_MODULE_OPTIONS";

export interface PalModuleOptions {
  adapter: PalAdapterType;
  rbacPort?: NativeRbacPort;
  compositeAdapters?: PalAdapterType[];
}
