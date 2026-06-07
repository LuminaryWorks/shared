import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PalService } from "../pal.service";
import { PAL_PERMISSION_KEY, type PalPermissionMetadata, type PalSubject } from "../types";

/** 请求需携带 user.sub（Logto JWT 验签后写入） */
export interface PalAuthenticatedRequest {
  user?: { sub?: string; orgId?: string; roles?: string[] };
}

@Injectable()
export class PalPermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private palService: PalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<PalPermissionMetadata | undefined>(
      PAL_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true;

    const request = context.switchToHttp().getRequest<PalAuthenticatedRequest>();
    const sub = request.user?.sub;
    if (!sub) {
      throw new UnauthorizedException("未登录");
    }

    const subject: PalSubject = {
      userId: sub,
      orgId: request.user?.orgId,
      roles: request.user?.roles,
    };

    const allowed = await this.palService.hasPermission(subject, {
      resource: meta.resource,
      action: meta.action,
    });
    if (!allowed) {
      throw new ForbiddenException(`无权限：${meta.resource}:${meta.action}`);
    }
    return true;
  }
}
