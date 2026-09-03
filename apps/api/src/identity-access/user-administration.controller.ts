import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import { AUTH_ROLES, type AuthenticatedUser } from "./auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "./authorization";
import { UserAdministrationService } from "./user-administration.service";
import {
  USER_STATUSES,
  type AdministrativeUser,
  type UserPage,
} from "./user-administration.types";

const uuidSchema = z.string().uuid();
const createUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320),
    password: z.string().min(12).max(128),
    role: z.enum(AUTH_ROLES),
    status: z.enum(USER_STATUSES).default("ACTIVE"),
  })
  .strict();
const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    password: z.string().min(12).max(128).optional(),
    role: z.enum(AUTH_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(AUTH_ROLES).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  sortBy: z
    .enum(["createdAt", "displayName", "email", "role", "status"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(USER_STATUSES).optional(),
});

class CreateUserRequestDto {
  @ApiProperty({ example: "Billing operator", maxLength: 120, minLength: 2 })
  displayName!: string;

  @ApiProperty({ example: "billing@example.com", format: "email" })
  email!: string;

  @ApiProperty({ format: "password", maxLength: 128, minLength: 12 })
  password!: string;

  @ApiProperty({ enum: AUTH_ROLES })
  role!: (typeof AUTH_ROLES)[number];

  @ApiPropertyOptional({ default: "ACTIVE", enum: USER_STATUSES })
  status?: (typeof USER_STATUSES)[number];
}

class UpdateUserRequestDto {
  @ApiPropertyOptional({ maxLength: 120, minLength: 2 })
  displayName?: string;

  @ApiPropertyOptional({ format: "email" })
  email?: string;

  @ApiPropertyOptional({ format: "password", maxLength: 128, minLength: 12 })
  password?: string;

  @ApiPropertyOptional({ enum: AUTH_ROLES })
  role?: (typeof AUTH_ROLES)[number];

  @ApiPropertyOptional({ enum: USER_STATUSES })
  status?: (typeof USER_STATUSES)[number];
}

class AdministrativeUserResponseDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "email" })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: AUTH_ROLES })
  role!: (typeof AUTH_ROLES)[number];

  @ApiProperty({ enum: USER_STATUSES })
  status!: (typeof USER_STATUSES)[number];

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;

  @ApiProperty({ format: "date-time", nullable: true, type: String })
  deletedAt!: string | null;
}

class UserPageResponseDto {
  @ApiProperty({ type: [AdministrativeUserResponseDto] })
  items!: AdministrativeUserResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ maximum: 100, minimum: 1 })
  pageSize!: number;

  @ApiProperty({ minimum: 0 })
  totalItems!: number;

  @ApiProperty({ minimum: 0 })
  totalPages!: number;
}

@ApiTags("users")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "ADMIN role required" })
@Controller("users")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class UserAdministrationController {
  constructor(
    @Inject(UserAdministrationService)
    private readonly users: UserAdministrationService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "listUsers", summary: "List users" })
  @ApiOkResponse({ type: UserPageResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ enum: AUTH_ROLES, name: "role", required: false })
  @ApiQuery({ enum: USER_STATUSES, name: "status", required: false })
  @ApiQuery({
    enum: ["createdAt", "displayName", "email", "role", "status"],
    name: "sortBy",
    required: false,
  })
  @ApiQuery({ enum: ["asc", "desc"], name: "sortOrder", required: false })
  list(@Query() query: Record<string, unknown>): Promise<UserPage> {
    return this.users.list(this.parse(userListQuerySchema, query));
  }

  @Post()
  @ApiOperation({ operationId: "createUser", summary: "Create a user" })
  @ApiCreatedResponse({ type: AdministrativeUserResponseDto })
  @ApiBadRequestResponse({ description: "Invalid user data" })
  @ApiConflictResponse({ description: "Email already registered" })
  create(
    @Body() body: CreateUserRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdministrativeUser> {
    return this.users.create(this.parse(createUserSchema, body), actor.id);
  }

  @Get(":userId")
  @ApiOperation({ operationId: "getUser", summary: "Read a user" })
  @ApiParam({ format: "uuid", name: "userId" })
  @ApiOkResponse({ type: AdministrativeUserResponseDto })
  @ApiNotFoundResponse({ description: "User not found" })
  get(@Param("userId") userId: string): Promise<AdministrativeUser> {
    return this.users.get(this.parse(uuidSchema, userId));
  }

  @Patch(":userId")
  @ApiOperation({ operationId: "updateUser", summary: "Update a user" })
  @ApiParam({ format: "uuid", name: "userId" })
  @ApiOkResponse({ type: AdministrativeUserResponseDto })
  @ApiBadRequestResponse({ description: "Invalid user data" })
  @ApiConflictResponse({
    description: "Duplicate email or last active administrator",
  })
  @ApiNotFoundResponse({ description: "User not found" })
  update(
    @Param("userId") userId: string,
    @Body() body: UpdateUserRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdministrativeUser> {
    return this.users.update(
      this.parse(uuidSchema, userId),
      this.parse(updateUserSchema, body),
      actor.id,
    );
  }

  @Delete(":userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteUser", summary: "Soft-delete a user" })
  @ApiParam({ format: "uuid", name: "userId" })
  @ApiNoContentResponse({ description: "User deleted logically" })
  @ApiConflictResponse({ description: "Last active administrator" })
  @ApiNotFoundResponse({ description: "User not found" })
  async delete(
    @Param("userId") userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.users.delete(this.parse(uuidSchema, userId), actor.id);
  }

  private parse<Schema extends z.ZodType>(
    schema: Schema,
    value: unknown,
  ): z.output<Schema> {
    const result = schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }

    return result.data;
  }
}
