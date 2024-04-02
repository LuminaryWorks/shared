import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { LuminaryAuthService } from "../auth.service";
import { LUMINARY_PUBLIC_KEY, type LuminaryAuthenticatedUser } from "../types";

export type LuminaryAuthRequest = {
  headers: { authorization?: string };
  user?: LuminaryAuthenticatedUser;
};

@Injectable()
export class LuminaryJwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: LuminaryAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(LUMINARY_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<LuminaryAuthRequest>();
    const token = this.authService.extractBearerToken(req.headers.authorization);
    if (!token) throw new UnauthorizedException("Missing Bearer token");

    req.user = await this.authService.verifyToken(token);
    return true;
  }
}
