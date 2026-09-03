import { createHash, randomBytes, randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import jsonwebtoken, { type JwtPayload } from "jsonwebtoken";

import type { EnvironmentVariables } from "../config/environment";

const ACCESS_TOKEN_ISSUER = "technology-ecommerce-api";
const ACCESS_TOKEN_AUDIENCE = "technology-ecommerce-frontends";
const REFRESH_TOKEN_PATTERN =
  /^(?<sessionId>[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(?<secret>[A-Za-z0-9_-]{43})$/i;

type AccessTokenClaims = Readonly<{
  sessionId: string;
  userId: string;
  expiresAt: Date;
}>;

type RefreshToken = Readonly<{
  sessionId: string;
  token: string;
  tokenHash: string;
}>;

@Injectable()
export class AuthTokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlSeconds: number;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.accessTokenSecret = config.get("AUTH_ACCESS_TOKEN_SECRET", {
      infer: true,
    });
    this.accessTokenTtlSeconds = config.get(
      "AUTH_ACCESS_TOKEN_TTL_SECONDS",
      { infer: true },
    );
    this.refreshTokenTtlSeconds = config.get(
      "AUTH_REFRESH_TOKEN_TTL_SECONDS",
      { infer: true },
    );
  }

  createSessionExpiry(now: Date): Date {
    return new Date(now.getTime() + this.refreshTokenTtlSeconds * 1_000);
  }

  createRefreshToken(sessionId: string = randomUUID()): RefreshToken {
    const token = `${sessionId}.${randomBytes(32).toString("base64url")}`;

    return {
      sessionId,
      token,
      tokenHash: this.hashRefreshToken(token),
    };
  }

  parseRefreshToken(
    token: string,
  ): Pick<RefreshToken, "sessionId" | "tokenHash"> | undefined {
    const match = REFRESH_TOKEN_PATTERN.exec(token);
    const sessionId = match?.groups?.sessionId;

    if (!sessionId) {
      return undefined;
    }

    return {
      sessionId,
      tokenHash: this.hashRefreshToken(token),
    };
  }

  createAccessToken(input: {
    sessionId: string;
    userId: string;
    sessionExpiresAt: Date;
    now: Date;
  }): { token: string; expiresAt: Date } {
    const maximumAccessExpiry = new Date(
      input.now.getTime() + this.accessTokenTtlSeconds * 1_000,
    );
    const expiresAt = new Date(
      Math.min(maximumAccessExpiry.getTime(), input.sessionExpiresAt.getTime()),
    );
    const expiresInSeconds = Math.max(
      1,
      Math.floor((expiresAt.getTime() - input.now.getTime()) / 1_000),
    );
    const token = jsonwebtoken.sign(
      { sid: input.sessionId, typ: "access" },
      this.accessTokenSecret,
      {
        algorithm: "HS256",
        audience: ACCESS_TOKEN_AUDIENCE,
        expiresIn: expiresInSeconds,
        issuer: ACCESS_TOKEN_ISSUER,
        jwtid: randomUUID(),
        subject: input.userId,
      },
    );

    return { token, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenClaims | undefined {
    try {
      const payload = jsonwebtoken.verify(token, this.accessTokenSecret, {
        algorithms: ["HS256"],
        audience: ACCESS_TOKEN_AUDIENCE,
        issuer: ACCESS_TOKEN_ISSUER,
      });

      if (typeof payload === "string") {
        return undefined;
      }

      return this.toAccessTokenClaims(payload);
    } catch {
      return undefined;
    }
  }

  private hashRefreshToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  private toAccessTokenClaims(
    payload: JwtPayload,
  ): AccessTokenClaims | undefined {
    if (
      payload.typ !== "access" ||
      typeof payload.sid !== "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number"
    ) {
      return undefined;
    }

    return {
      sessionId: payload.sid,
      userId: payload.sub,
      expiresAt: new Date(payload.exp * 1_000),
    };
  }
}
