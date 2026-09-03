import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthRole } from "../auth.types";
import {
  type AuthenticatedRequest,
  requireAuthenticatedUser,
} from "./authenticated-request";
import { REQUIRED_ROLES_METADATA } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<readonly AuthRole[]>(
      REQUIRED_ROLES_METADATA,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = requireAuthenticatedUser(request);

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "You do not have permission to perform this operation",
      });
    }

    return true;
  }
}
