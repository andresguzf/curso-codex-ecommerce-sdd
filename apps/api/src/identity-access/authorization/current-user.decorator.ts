import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedUser } from "../auth.types";
import {
  type AuthenticatedRequest,
  requireAuthenticatedUser,
} from "./authenticated-request";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return requireAuthenticatedUser(request);
  },
);
