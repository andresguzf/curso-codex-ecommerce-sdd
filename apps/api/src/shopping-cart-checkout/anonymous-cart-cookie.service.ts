import { createHash, randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { EnvironmentVariables } from "../config/environment";
import type { CartOwner } from "./cart.types";

export const ANONYMOUS_CART_COOKIE = "technology_ecommerce_cart";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class AnonymousCartCookieService {
  private readonly maxAge: number;
  private readonly sameSite: "lax" | "none" | "strict";
  private readonly secure: boolean;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.maxAge = config.get("CART_ANONYMOUS_TTL_SECONDS", { infer: true });
    this.sameSite = config.get("AUTH_COOKIE_SAME_SITE", { infer: true });
    this.secure = config.get("AUTH_COOKIE_SECURE", { infer: true });
  }

  resolve(
    request: FastifyRequest,
    reply: FastifyReply,
  ): CartOwner {
    const current = request.cookies[ANONYMOUS_CART_COOKIE];
    const token = current && TOKEN_PATTERN.test(current)
      ? current
      : randomBytes(32).toString("base64url");
    this.persist(reply, token);

    return {
      anonymousTokenHash: this.hash(token),
      expiresAt: new Date(Date.now() + this.maxAge * 1_000),
      kind: "anonymous",
    };
  }

  hashFromRequest(request: FastifyRequest): string | undefined {
    const token = request.cookies[ANONYMOUS_CART_COOKIE];
    return token && TOKEN_PATTERN.test(token) ? this.hash(token) : undefined;
  }

  clear(reply: FastifyReply): void {
    reply.clearCookie(ANONYMOUS_CART_COOKIE, {
      httpOnly: true,
      path: "/api/v1",
      sameSite: this.sameSite,
      secure: this.secure,
    });
  }

  private persist(reply: FastifyReply, token: string): void {
    reply.setCookie(ANONYMOUS_CART_COOKIE, token, {
      httpOnly: true,
      maxAge: this.maxAge,
      path: "/api/v1",
      sameSite: this.sameSite,
      secure: this.secure,
    });
    reply.header("Cache-Control", "no-store");
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
