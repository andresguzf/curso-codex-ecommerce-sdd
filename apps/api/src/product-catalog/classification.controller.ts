import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Inject, Param, Patch, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse,
  ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse,
  ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import {
  AuthenticationGuard, CurrentUser, OptionalAuthenticationGuard, Roles,
  RolesGuard, type AuthenticatedRequest,
} from "../identity-access/authorization/index.js";
import { ClassificationService } from "./classification.service.js";
import {
  CLASSIFICATION_SORT_FIELDS, CLASSIFICATION_STATUSES,
  type CategoryRecord, type ClassificationPage, type ClassificationQuery, type TagRecord,
} from "./classification.types.js";

const identifierSchema = z.string().uuid();
const viewSchema = z.object({ view: z.enum(["public", "administrative"]).default("public") }).strict();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(CLASSIFICATION_STATUSES).optional(),
  sortBy: z.enum(CLASSIFICATION_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  view: z.enum(["public", "administrative"]).default("public"),
}).strict();
const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(10_000).default(""),
  status: z.enum(CLASSIFICATION_STATUSES).default("ACTIVE"),
}).strict();
const categoryListSchema = listSchema.extend({
  showOnLanding: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
}).refine((value) => value.showOnLanding === undefined || value.view === "administrative", {
  message: "Editorial filtering requires the administrative view", path: ["showOnLanding"],
});
const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  description: z.string().trim().max(10_000).optional(),
  status: z.enum(CLASSIFICATION_STATUSES).optional(),
  showOnLanding: z.boolean().optional(),
  landingOrder: z.number().int().min(1).max(3).nullable().optional(),
}).refine((value) => Object.keys(value).length > 0);
const tagCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(140).optional(),
  status: z.enum(CLASSIFICATION_STATUSES).default("ACTIVE"),
}).strict();
const tagUpdateSchema = tagCreateSchema.partial().refine((value) => Object.keys(value).length > 0);

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({
    code: "REQUEST_VALIDATION_FAILED", message: "The request is invalid",
    details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
  });
  return result.data;
}

class ClassificationBaseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: CLASSIFICATION_STATUSES }) status!: "ACTIVE" | "INACTIVE";
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ format: "date-time", nullable: true, type: String }) deletedAt!: string | null;
}
class CategoryDto extends ClassificationBaseDto {
  @ApiPropertyOptional({ type: Boolean, description: "ADMIN view and mutation responses only" }) showOnLanding?: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 3, description: "ADMIN view and mutation responses only" }) landingOrder?: number | null;
  @ApiProperty() description!: string;
}
class TagDto extends ClassificationBaseDto {}
class CategoryPageDto {
  @ApiProperty({ type: [CategoryDto] }) items!: CategoryDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}
class TagPageDto {
  @ApiProperty({ type: [TagDto] }) items!: TagDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}
class CreateCategoryDto {
  @ApiProperty({ maxLength: 200 }) name!: string;
  @ApiPropertyOptional({ maxLength: 220 }) slug?: string;
  @ApiPropertyOptional({ maxLength: 10_000 }) description?: string;
  @ApiPropertyOptional({ enum: CLASSIFICATION_STATUSES }) status?: "ACTIVE" | "INACTIVE";
}
class UpdateCategoryDto {
  @ApiPropertyOptional({ type: Boolean }) showOnLanding?: boolean;
  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1, maximum: 3, description: "Swap positions when both categories are already selected" }) landingOrder?: number | null;
  @ApiPropertyOptional({ maxLength: 200 }) name?: string;
  @ApiPropertyOptional({ maxLength: 220 }) slug?: string;
  @ApiPropertyOptional({ maxLength: 10_000 }) description?: string;
  @ApiPropertyOptional({ enum: CLASSIFICATION_STATUSES }) status?: "ACTIVE" | "INACTIVE";
}
class CreateTagDto {
  @ApiProperty({ maxLength: 120 }) name!: string;
  @ApiPropertyOptional({ maxLength: 140 }) slug?: string;
  @ApiPropertyOptional({ enum: CLASSIFICATION_STATUSES }) status?: "ACTIVE" | "INACTIVE";
}
class UpdateTagDto {
  @ApiPropertyOptional({ maxLength: 120 }) name?: string;
  @ApiPropertyOptional({ maxLength: 140 }) slug?: string;
  @ApiPropertyOptional({ enum: CLASSIFICATION_STATUSES }) status?: "ACTIVE" | "INACTIVE";
}

@ApiTags("categories")
@Controller("categories")
export class CategoryController {
  constructor(@Inject(ClassificationService) private readonly classifications: ClassificationService) {}

  @Get()
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({ operationId: "listCategories", summary: "List categories" })
  @ApiQuery({ name: "showOnLanding", required: false, type: Boolean, description: "ADMIN view only; filter selected categories including inactive selections" })
  @ApiOkResponse({ type: CategoryPageDto })
  @ApiBadRequestResponse({ description: "Invalid query" })
  @ApiUnauthorizedResponse({ description: "Administrative view requires authentication" })
  @ApiForbiddenResponse({ description: "Administrative view requires ADMIN" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "status", required: false, enum: CLASSIFICATION_STATUSES })
  @ApiQuery({ name: "sortBy", required: false, enum: CLASSIFICATION_SORT_FIELDS })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "view", required: false, enum: ["public", "administrative"] })
  list(@Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest): Promise<ClassificationPage<CategoryRecord>> {
    return this.classifications.listCategories(parse(categoryListSchema, query) as ClassificationQuery, request.authUser);
  }

  @Get(":categoryId")
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({ operationId: "getCategory", summary: "Read a category" })
  @ApiParam({ name: "categoryId", format: "uuid" })
  @ApiQuery({ name: "view", required: false, enum: ["public", "administrative"] })
  @ApiOkResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ description: "Invalid identifier or view" })
  @ApiNotFoundResponse({ description: "Category not found" })
  get(@Param("categoryId") id: string, @Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest): Promise<CategoryRecord> {
    return this.classifications.getCategory(parse(identifierSchema, id), parse(viewSchema, query).view === "administrative", request.authUser);
  }

  @Post()
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "createCategory", summary: "Create a category" })
  @ApiCreatedResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ description: "Invalid category data" })
  @ApiConflictResponse({ description: "Duplicate name or slug" })
  create(@Body() body: CreateCategoryDto, @CurrentUser() actor: AuthenticatedUser): Promise<CategoryRecord> {
    return this.classifications.createCategory(parse(categoryCreateSchema, body), actor.id);
  }

  @Patch(":categoryId")
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "updateCategory", summary: "Update a category or its status" })
  @ApiParam({ name: "categoryId", format: "uuid" })
  @ApiOkResponse({ type: CategoryDto })
  @ApiBadRequestResponse({ description: "Invalid category data" })
  @ApiConflictResponse({ description: "Duplicate name or slug" })
  @ApiNotFoundResponse({ description: "Category not found" })
  update(@Param("categoryId") id: string, @Body() body: UpdateCategoryDto, @CurrentUser() actor: AuthenticatedUser): Promise<CategoryRecord> {
    return this.classifications.updateCategory(parse(identifierSchema, id), parse(categoryUpdateSchema, body), actor.id);
  }

  @Delete(":categoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "deleteCategory", summary: "Soft-delete a category" })
  @ApiParam({ name: "categoryId", format: "uuid" })
  @ApiNoContentResponse({ description: "Category deleted logically" })
  @ApiNotFoundResponse({ description: "Category not found" })
  delete(@Param("categoryId") id: string, @CurrentUser() actor: AuthenticatedUser): Promise<void> {
    return this.classifications.deleteCategory(parse(identifierSchema, id), actor.id);
  }
}

@ApiTags("tags")
@Controller("tags")
export class TagController {
  constructor(@Inject(ClassificationService) private readonly classifications: ClassificationService) {}

  @Get()
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({ operationId: "listTags", summary: "List tags" })
  @ApiOkResponse({ type: TagPageDto })
  @ApiBadRequestResponse({ description: "Invalid query" })
  @ApiUnauthorizedResponse({ description: "Administrative view requires authentication" })
  @ApiForbiddenResponse({ description: "Administrative view requires ADMIN" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "status", required: false, enum: CLASSIFICATION_STATUSES })
  @ApiQuery({ name: "sortBy", required: false, enum: CLASSIFICATION_SORT_FIELDS })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiQuery({ name: "view", required: false, enum: ["public", "administrative"] })
  list(@Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest): Promise<ClassificationPage<TagRecord>> {
    return this.classifications.listTags(parse(listSchema, query) as ClassificationQuery, request.authUser);
  }

  @Get(":tagId")
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({ operationId: "getTag", summary: "Read a tag" })
  @ApiParam({ name: "tagId", format: "uuid" })
  @ApiQuery({ name: "view", required: false, enum: ["public", "administrative"] })
  @ApiOkResponse({ type: TagDto })
  @ApiBadRequestResponse({ description: "Invalid identifier or view" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  get(@Param("tagId") id: string, @Query() query: Record<string, unknown>, @Req() request: AuthenticatedRequest): Promise<TagRecord> {
    return this.classifications.getTag(parse(identifierSchema, id), parse(viewSchema, query).view === "administrative", request.authUser);
  }

  @Post()
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "createTag", summary: "Create a tag" })
  @ApiCreatedResponse({ type: TagDto })
  @ApiBadRequestResponse({ description: "Invalid tag data" })
  @ApiConflictResponse({ description: "Duplicate name or slug" })
  create(@Body() body: CreateTagDto, @CurrentUser() actor: AuthenticatedUser): Promise<TagRecord> {
    return this.classifications.createTag(parse(tagCreateSchema, body), actor.id);
  }

  @Patch(":tagId")
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "updateTag", summary: "Update a tag or its status" })
  @ApiParam({ name: "tagId", format: "uuid" })
  @ApiOkResponse({ type: TagDto })
  @ApiBadRequestResponse({ description: "Invalid tag data" })
  @ApiConflictResponse({ description: "Duplicate name or slug" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  update(@Param("tagId") id: string, @Body() body: UpdateTagDto, @CurrentUser() actor: AuthenticatedUser): Promise<TagRecord> {
    return this.classifications.updateTag(parse(identifierSchema, id), parse(tagUpdateSchema, body), actor.id);
  }

  @Delete(":tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth("access-token")
  @ApiOperation({ operationId: "deleteTag", summary: "Soft-delete a tag" })
  @ApiParam({ name: "tagId", format: "uuid" })
  @ApiNoContentResponse({ description: "Tag deleted logically" })
  @ApiNotFoundResponse({ description: "Tag not found" })
  delete(@Param("tagId") id: string, @CurrentUser() actor: AuthenticatedUser): Promise<void> {
    return this.classifications.deleteTag(parse(identifierSchema, id), actor.id);
  }
}
