import type {
  PalContext,
  PalSubject,
  PermissionAbstractionLayer,
  PermissionCode,
} from "../types";

/** 蓝鲸 BK-IAM adapter 骨架 — I-4 实现 HTTP 调用 */
export class StubBkIamPalAdapter implements PermissionAbstractionLayer {
  async hasPermission(_subject: PalSubject, _ctx: PalContext): Promise<boolean> {
    throw new Error(
      "BkIamPalAdapter not implemented. Set PAL_ADAPTER=native or implement I-4.",
    );
  }

  async listPermissions(_subject: PalSubject): Promise<PermissionCode[]> {
    throw new Error("BkIamPalAdapter not implemented.");
  }

  async listRoles(_subject: PalSubject): Promise<string[]> {
    throw new Error("BkIamPalAdapter not implemented.");
  }
}
