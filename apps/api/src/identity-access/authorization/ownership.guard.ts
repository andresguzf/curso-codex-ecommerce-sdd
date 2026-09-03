import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import {
  type AuthenticatedRequest,
  requireAuthenticatedUser,
} from "./authenticated-request";
import {
  OWNERSHIP_METADATA,
  type OwnershipRequirement,
} from "./ownership.decorator";
import { ResourceOwnershipService } from "./resource-ownership.service";

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(ResourceOwnershipService)
    private readonly ownership: ResourceOwnershipService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement =
      this.reflector.getAllAndOverride<OwnershipRequirement>(
        OWNERSHIP_METADATA,
        [context.getHandler(), context.getClass()],
      );

    if (!requirement) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = requireAuthenticatedUser(request);

    if (requirement.bypassRoles?.includes(user.role)) {
      return true;
    }

    const parameters = request.params as Record<string, string>;
    const resourceId = parameters[requirement.resourceIdParameter];
    const isOwner =
      resourceId &&
      (await this.ownership.isOwner(
        requirement.resourceType,
        resourceId,
        user.id,
      ));

    if (!isOwner) {
      throw new ForbiddenException({
        code: "AUTH_RESOURCE_FORBIDDEN",
        message: "You do not have permission to access this resource",
      });
    }

    return true;
  }
}
