import { UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../auth.types";

export type AuthenticatedRequest = FastifyRequest & {
  authUser?: AuthenticatedUser;
};

export function requireAuthenticatedUser(
  request: AuthenticatedRequest,
): AuthenticatedUser {
  if (!request.authUser) {
    throw new UnauthorizedException({
      code: "AUTH_INVALID_SESSION",
      message: "The session credential is invalid or expired",
    });
  }

  return request.authUser;
}
