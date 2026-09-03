import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";

import { AuthService } from "../auth.service";
import type { AuthenticatedRequest } from "./authenticated-request";

@Injectable()
export class OptionalAuthenticationGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (request.headers.authorization) {
      request.authUser = await this.auth.authenticateAuthorizationHeader(
        request.headers.authorization,
      );
    }

    return true;
  }
}
