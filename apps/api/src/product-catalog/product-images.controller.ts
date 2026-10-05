import { BadRequestException, Body, Controller, Delete, Headers, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiConsumes, ApiCreatedResponse, ApiForbiddenResponse, ApiNoContentResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization/index.js";
import { ProductImagesService } from "./product-images.service.js";

const patchSchema = z.object({ altText: z.string().trim().min(1).max(500).optional(), isPrimary: z.boolean().optional(), sortOrder: z.number().int().min(0).max(2_147_483_646).optional() }).strict().refine((value) => Object.keys(value).length > 0);
const uploadSchema = z.object({ altText: z.string().trim().min(1).max(500), isPrimary: z.enum(["true", "false"]).transform((value) => value === "true").optional(), sortOrder: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2_147_483_646)).optional() }).strict();
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "The image request is invalid" });
  return parsed.data;
}
export class ProductGalleryImageDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ minLength: 1, maxLength: 500 }) altText!: string;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ type: "integer", minimum: 0 }) sortOrder!: number;
  @ApiProperty({ type: "integer", nullable: true, minimum: 1 }) width!: number | null;
  @ApiProperty({ type: "integer", nullable: true, minimum: 1 }) height!: number | null;
  @ApiProperty({ type: String, nullable: true }) mimeType!: string | null;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}
class PatchProductImageDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 500 }) altText?: string;
  @ApiPropertyOptional() isPrimary?: boolean;
  @ApiPropertyOptional({ type: "integer", minimum: 0, maximum: 2_147_483_646 }) sortOrder?: number;
}
@ApiTags("products")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Authentication required" })
@ApiForbiddenResponse({ description: "ADMIN role required" })
@ApiNotFoundResponse({ description: "Product or image not found" })
@ApiBadRequestResponse({ description: "Invalid image, metadata or position" })
@ApiConflictResponse({ description: "An active product must retain its cover" })
@ApiParam({ name: "productId", format: "uuid" })
@Controller("products/:productId/images")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class ProductImagesController {
  constructor(@Inject(ProductImagesService) private readonly images: ProductImagesService) {}

  @Post()
  @ApiOperation({ operationId: "addProductImage", summary: "Upload a product image; append by default, first image becomes cover" })
  @ApiConflictResponse({ description: "PRODUCT_IMAGE_LIMIT_REACHED: at most four images per product including the cover; concurrent uploads are serialized. Existing oversized galleries are preserved but cannot grow." })
  @ApiConsumes("image/png", "image/jpeg", "image/webp")
  @ApiBody({ schema: { type: "string", format: "binary" } })
  @ApiQuery({ name: "altText", required: true, type: String, minLength: 1, maxLength: 500 })
  @ApiQuery({ name: "isPrimary", required: false, type: Boolean })
  @ApiQuery({ name: "sortOrder", required: false, type: "integer", minimum: 0, maximum: 2_147_483_646 })
  @ApiCreatedResponse({ type: ProductGalleryImageDto })
  @ApiResponse({ status: 413, description: "Image exceeds the configured upload limit" })
  @ApiResponse({ status: 502, description: "IMAGE_STORAGE_UPSTREAM_ERROR: invalid image storage response; recover the gallery before retrying" })
  @ApiResponse({ status: 503, description: "IMAGE_STORAGE_UNAVAILABLE: image storage temporarily unavailable; no automatic upload retries or local fallback" })
  @ApiResponse({ status: 504, description: "IMAGE_STORAGE_TIMEOUT: remote result may be uncertain; recover the gallery before retrying" })
  add(@Param("productId") productId: string, @CurrentUser() actor: AuthenticatedUser, @Body() data: unknown, @Query() query: unknown, @Headers("content-type") mimeType?: string) {
    return this.images.add(validate(z.string().uuid(), productId), actor.id, data, mimeType, validate(uploadSchema, query));
  }

  @Patch(":imageId")
  @ApiOperation({ operationId: "updateProductImage", summary: "Edit alt text, move to a zero-based position or select the cover atomically" })
  @ApiOkResponse({ type: ProductGalleryImageDto })
  @ApiParam({ name: "imageId", format: "uuid" })
  @ApiBody({ schema: { type: "object", additionalProperties: false, minProperties: 1, properties: {
    altText: { type: "string", minLength: 1, maxLength: 500 },
    isPrimary: { type: "boolean" }, sortOrder: { type: "integer", minimum: 0, maximum: 2_147_483_646 },
  } } })
  edit(@Param("productId") productId: string, @Param("imageId") imageId: string, @CurrentUser() actor: AuthenticatedUser, @Body() body: PatchProductImageDto) {
    return this.images.edit(validate(z.string().uuid(), productId), validate(z.string().uuid(), imageId), actor.id, validate(patchSchema, body));
  }

  @Delete(":imageId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteProductImage", summary: "Remove an image, preserving the cover of active products" })
  @ApiNoContentResponse({ description: "Image reference removed; remaining positions normalized" })
  @ApiParam({ name: "imageId", format: "uuid" })
  delete(@Param("productId") productId: string, @Param("imageId") imageId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.images.delete(validate(z.string().uuid(), productId), validate(z.string().uuid(), imageId), actor.id);
  }
}
