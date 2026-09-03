import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { EnvironmentVariables } from "../config/environment";

export const REFRESH_TOKEN_COOKIE = "technology_ecommerce_refresh";
export const CSRF_TOKEN_COOKIE = "XSRF-TOKEN";
export const CSRF_TOKEN_HEADER = "x-csrf-token";

@Injectable()
export class AuthCookieService {
  private readonly maxAge: number;
  private readonly sameSite: "lax" | "none" | "strict";
  private readonly secure: boolean;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxAge = config.get("AUTH_REFRESH_TOKEN_TTL_SECONDS", {
      infer: true,
    });
    this.sameSite = config.get("AUTH_COOKIE_SAME_SITE", { infer: true });
    this.secure = config.get("AUTH_COOKIE_SECURE", { infer: true });
  }

  setSessionCookies(reply: FastifyReply, refreshToken: string): void {
    const commonOptions = {
      maxAge: this.maxAge,
      path: "/api/v1/auth",
      sameSite: this.sameSite,
      secure: this.secure,
    } as const;

    reply.setCookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...commonOptions,
      httpOnly: true,
    });
    this.issueCsrfToken(reply);
  }

  issueCsrfToken(reply: FastifyReply): string {
    const csrfToken = randomBytes(32).toString("base64url");

    reply.setCookie(CSRF_TOKEN_COOKIE, csrfToken, {
      maxAge: this.maxAge,
      path: "/api/v1/auth",
      sameSite: this.sameSite,
      secure: this.secure,
      httpOnly: false,
    });
    reply.header(CSRF_TOKEN_HEADER, csrfToken);
    reply.header("Cache-Control", "no-store");

    return csrfToken;
  }

  clearSessionCookies(reply: FastifyReply): void {
    const commonOptions = {
      path: "/api/v1/auth",
      sameSite: this.sameSite,
      secure: this.secure,
    } as const;

    reply.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...commonOptions,
      httpOnly: true,
    });
    reply.clearCookie(CSRF_TOKEN_COOKIE, {
      ...commonOptions,
      httpOnly: false,
    });
  }

  getRefreshToken(request: FastifyRequest): string | undefined {
    return request.cookies[REFRESH_TOKEN_COOKIE];
  }
}
