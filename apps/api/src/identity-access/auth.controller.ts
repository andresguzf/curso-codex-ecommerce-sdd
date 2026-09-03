import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  AuthenticationGuard,
  CurrentUser,
} from "./authorization";
import {
  AuthCookieService,
  CSRF_TOKEN_HEADER,
  REFRESH_TOKEN_COOKIE,
} from "./auth-cookie.service";
import { AuthService } from "./auth.service";
import {
  AUTH_ROLES,
  type AuthenticatedUser,
  type AuthSession,
  type PublicAuthSession,
} from "./auth.types";
import { AuthenticationRateLimitError } from "./authentication-attempt-limiter.service";
import { CsrfGuard } from "./csrf.guard";

const loginRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(1_024),
});

const registerRequestSchema = z
  .object({
    email: z.string().trim().email().max(320),
    displayName: z.string().trim().min(2).max(120),
    password: z.string().min(12).max(128),
  })
  .strict();

class LoginRequestDto {
  @ApiProperty({ example: "customer@example.com", format: "email" })
  email!: string;

  @ApiProperty({ example: "a-strong-local-password", format: "password" })
  password!: string;
}

class RegisterRequestDto {
  @ApiProperty({ example: "customer@example.com", format: "email" })
  email!: string;

  @ApiProperty({ example: "Example customer", maxLength: 120, minLength: 2 })
  displayName!: string;

  @ApiProperty({
    example: "a-strong-local-password",
    format: "password",
    maxLength: 128,
    minLength: 12,
  })
  password!: string;
}

class AuthenticatedUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: AUTH_ROLES })
  role!: (typeof AUTH_ROLES)[number];
}

class AuthSessionResponseDto {
  @ApiProperty({ description: "Short-lived signed JWT access token" })
  accessToken!: string;

  @ApiProperty({ enum: ["Bearer"] })
  tokenType!: "Bearer";

  @ApiProperty({ format: "date-time" })
  accessTokenExpiresAt!: string;

  @ApiProperty({ format: "date-time" })
  sessionExpiresAt!: string;

  @ApiProperty({ type: AuthenticatedUserResponseDto })
  user!: AuthenticatedUserResponseDto;
}

class CsrfTokenResponseDto {
  @ApiProperty({ description: "Token required in the X-CSRF-Token header" })
  csrfToken!: string;
}

@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(AuthCookieService) private readonly cookies: AuthCookieService,
  ) {}

  @Post("register")
  @ApiOperation({
    operationId: "registerCustomer",
    summary: "Register a public customer account",
  })
  @ApiCreatedResponse({ type: AuthenticatedUserResponseDto })
  @ApiBadRequestResponse({
    description: "Malformed input or an attempted role assignment",
  })
  @ApiConflictResponse({ description: "Email already registered" })
  async register(
    @Body() body: RegisterRequestDto,
  ): Promise<AuthenticatedUserResponseDto> {
    const input = this.parse(registerRequestSchema, body);

    return this.auth.register(input);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "login", summary: "Authenticate a user" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: "Malformed credentials" })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @ApiTooManyRequestsResponse({ description: "Authentication rate limit" })
  @ApiHeader({ name: "Origin", required: false })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PublicAuthSession> {
    const input = this.parse(loginRequestSchema, body);

    try {
      const session = await this.auth.login(input.email, input.password, {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      return this.setSessionCookies(reply, session);
    } catch (error) {
      if (error instanceof AuthenticationRateLimitError) {
        reply.header("Retry-After", error.retryAfterSeconds);
      }

      throw error;
    }
  }

  @Get("csrf")
  @ApiOperation({
    operationId: "getCsrfToken",
    summary: "Issue a CSRF token for cookie-authenticated requests",
  })
  @ApiOkResponse({ type: CsrfTokenResponseDto })
  getCsrfToken(
    @Res({ passthrough: true }) reply: FastifyReply,
  ): CsrfTokenResponseDto {
    return { csrfToken: this.cookies.issueCsrfToken(reply) };
  }

  @Post("refresh")
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiHeader({ name: CSRF_TOKEN_HEADER, required: true })
  @ApiOperation({ operationId: "refreshSession", summary: "Rotate a session" })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  @ApiForbiddenResponse({ description: "Invalid CSRF token" })
  @ApiUnauthorizedResponse({ description: "Invalid or expired session" })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<PublicAuthSession> {
    const session = await this.auth.refresh(
      this.cookies.getRefreshToken(request) ?? "",
    );

    return this.setSessionCookies(reply, session);
  }

  @Post("logout")
  @UseGuards(CsrfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiHeader({ name: CSRF_TOKEN_HEADER, required: true })
  @ApiOperation({ operationId: "logout", summary: "Revoke a session" })
  @ApiNoContentResponse({ description: "Session revoked" })
  @ApiForbiddenResponse({ description: "Invalid CSRF token" })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(this.cookies.getRefreshToken(request) ?? "");
    this.cookies.clearSessionCookies(reply);
  }

  private setSessionCookies(
    reply: FastifyReply,
    session: AuthSession,
  ): PublicAuthSession {
    this.cookies.setSessionCookies(reply, session.refreshToken);

    return {
      accessToken: session.accessToken,
      accessTokenExpiresAt: session.accessTokenExpiresAt,
      sessionExpiresAt: session.sessionExpiresAt,
      tokenType: session.tokenType,
      user: session.user,
    };
  }

  @Get("me")
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "getCurrentUser", summary: "Read current user" })
  @ApiOkResponse({ type: AuthenticatedUserResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid or expired session" })
  getCurrentUser(
    @CurrentUser() user: AuthenticatedUser,
  ): AuthenticatedUserResponseDto {
    return user;
  }

  private parse<Schema extends z.ZodType>(
    schema: Schema,
    value: unknown,
  ): z.output<Schema> {
    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request body is invalid",
      });
    }

    return result.data;
  }
}
