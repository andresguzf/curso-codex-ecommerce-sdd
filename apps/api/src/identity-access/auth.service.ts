import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

import { AuthRepository } from "./auth.repository";
import { AuthTokenService } from "./auth-token.service";
import { AuthenticationAttemptLimiter } from "./authentication-attempt-limiter.service";
import type {
  AuthenticatedUser,
  AuthSession,
  SessionUser,
} from "./auth.types";
import { PasswordService } from "./password/password.service";

type RequestMetadata = Readonly<{
  ipAddress?: string;
  userAgent?: string;
}>;

const INVALID_CREDENTIALS_RESPONSE = {
  code: "AUTH_INVALID_CREDENTIALS",
  message: "Invalid email or password",
} as const;

const INVALID_SESSION_RESPONSE = {
  code: "AUTH_INVALID_SESSION",
  message: "The session credential is invalid or expired",
} as const;

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private readonly repository: AuthRepository,
    @Inject(AuthTokenService) private readonly tokens: AuthTokenService,
    @Inject(PasswordService) private readonly passwords: PasswordService,
    @Inject(AuthenticationAttemptLimiter)
    private readonly attempts: AuthenticationAttemptLimiter,
  ) {}

  async register(input: {
    email: string;
    displayName: string;
    password: string;
  }): Promise<AuthenticatedUser> {
    const passwordHash = await this.passwords.hash(input.password);

    try {
      return await this.repository.createCustomer({
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        passwordHash,
      });
    } catch (error) {
      if (this.isUniqueEmailViolation(error)) {
        throw new ConflictException({
          code: "AUTH_EMAIL_ALREADY_REGISTERED",
          message: "An account with this email already exists",
        });
      }

      throw error;
    }
  }

  async login(
    email: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<AuthSession> {
    const normalizedEmail = email.trim().toLowerCase();
    this.attempts.assertAllowed(metadata.ipAddress, normalizedEmail);
    const user = await this.repository.findUserForLogin(normalizedEmail);

    if (!user) {
      await this.passwords.verifyAgainstDummyHash(password);
      this.attempts.recordFailure(metadata.ipAddress, normalizedEmail);
      throw this.invalidCredentials();
    }

    const passwordMatches = await this.passwords.verify(
      password,
      user.passwordHash,
    );

    if (
      !passwordMatches ||
      user.status !== "ACTIVE" ||
      user.deletedAt !== null
    ) {
      this.attempts.recordFailure(metadata.ipAddress, normalizedEmail);
      throw this.invalidCredentials();
    }

    this.attempts.recordSuccess(metadata.ipAddress, normalizedEmail);

    if (this.passwords.needsRehash(user.passwordHash)) {
      await this.repository.updatePasswordHash(
        user.id,
        await this.passwords.hash(password),
      );
    }

    const now = new Date();
    const refreshToken = this.tokens.createRefreshToken();
    const sessionExpiresAt = this.tokens.createSessionExpiry(now);

    await this.repository.createSession({
      id: refreshToken.sessionId,
      userId: user.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: sessionExpiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    });

    return this.createAuthSession(
      user,
      refreshToken.token,
      refreshToken.sessionId,
      sessionExpiresAt,
      now,
    );
  }

  async refresh(refreshTokenValue: string): Promise<AuthSession> {
    const parsedToken = this.tokens.parseRefreshToken(refreshTokenValue);

    if (!parsedToken) {
      throw this.invalidSession();
    }

    const now = new Date();
    const session = await this.repository.findSessionByRefreshToken(
      parsedToken.sessionId,
      parsedToken.tokenHash,
    );

    if (!this.isActiveSession(session, now)) {
      throw this.invalidSession();
    }

    const nextRefreshToken = this.tokens.createRefreshToken(session.sessionId);
    const rotated = await this.repository.rotateRefreshToken({
      sessionId: session.sessionId,
      previousTokenHash: parsedToken.tokenHash,
      nextTokenHash: nextRefreshToken.tokenHash,
      now,
    });

    if (!rotated) {
      throw this.invalidSession();
    }

    return this.createAuthSession(
      session,
      nextRefreshToken.token,
      session.sessionId,
      session.sessionExpiresAt,
      now,
    );
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const parsedToken = this.tokens.parseRefreshToken(refreshTokenValue);

    if (!parsedToken) {
      return;
    }

    await this.repository.revokeByRefreshToken(
      parsedToken.sessionId,
      parsedToken.tokenHash,
      new Date(),
    );
  }

  async authenticate(accessToken: string): Promise<AuthenticatedUser> {
    const claims = this.tokens.verifyAccessToken(accessToken);

    if (!claims) {
      throw this.invalidSession();
    }

    const session = await this.repository.findSessionById(claims.sessionId);

    if (
      !this.isActiveSession(session, new Date()) ||
      session.id !== claims.userId
    ) {
      throw this.invalidSession();
    }

    return this.toAuthenticatedUser(session);
  }

  authenticateAuthorizationHeader(
    authorizationHeader: string | undefined,
  ): Promise<AuthenticatedUser> {
    const [scheme, token, unexpected] =
      authorizationHeader?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token || unexpected) {
      throw this.invalidSession();
    }

    return this.authenticate(token);
  }

  private createAuthSession(
    user: AuthenticatedUser,
    refreshToken: string,
    sessionId: string,
    sessionExpiresAt: Date,
    now: Date,
  ): AuthSession {
    const accessToken = this.tokens.createAccessToken({
      sessionId,
      userId: user.id,
      sessionExpiresAt,
      now,
    });

    return {
      accessToken: accessToken.token,
      refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresAt: accessToken.expiresAt.toISOString(),
      sessionExpiresAt: sessionExpiresAt.toISOString(),
      user: this.toAuthenticatedUser(user),
    };
  }

  private isActiveSession(
    session: SessionUser | undefined,
    now: Date,
  ): session is SessionUser {
    return Boolean(
      session &&
        session.sessionRevokedAt === null &&
        session.sessionExpiresAt.getTime() > now.getTime() &&
        session.userStatus === "ACTIVE" &&
        session.userDeletedAt === null,
    );
  }

  private toAuthenticatedUser(user: AuthenticatedUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException(INVALID_CREDENTIALS_RESPONSE);
  }

  private invalidSession(): UnauthorizedException {
    return new UnauthorizedException(INVALID_SESSION_RESPONSE);
  }

  private isUniqueEmailViolation(error: unknown): boolean {
    let current: unknown = error;

    for (let depth = 0; depth < 3 && current; depth += 1) {
      if (
        typeof current === "object" &&
        "code" in current &&
        current.code === "23505" &&
        "constraint" in current &&
        current.constraint === "users_email_unique"
      ) {
        return true;
      }

      current =
        typeof current === "object" && "cause" in current
          ? current.cause
          : undefined;
    }

    return false;
  }
}
