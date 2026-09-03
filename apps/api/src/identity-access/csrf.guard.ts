import { timingSafeEqual } from "node:crypto";

import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER } from "./auth-cookie.service";

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const cookieToken = request.cookies[CSRF_TOKEN_COOKIE];
    const headerToken = request.headers[CSRF_TOKEN_HEADER];

    if (
      !cookieToken ||
      typeof headerToken !== "string" ||
      !this.tokensMatch(cookieToken, headerToken)
    ) {
      throw new ForbiddenException({
        code: "CSRF_TOKEN_INVALID",
        message: "A valid CSRF token is required",
      });
    }

    return true;
  }

  private tokensMatch(cookieToken: string, headerToken: string): boolean {
    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    return (
      cookieBuffer.length === headerBuffer.length &&
      timingSafeEqual(cookieBuffer, headerBuffer)
    );
  }
}
