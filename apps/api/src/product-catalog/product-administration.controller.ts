import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
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
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import { ProductAdministrationService } from "./product-administration.service";
import {
  PRODUCT_STATUSES,
  type AdministrativeProduct,
} from "./product-administration.types";

const uuidSchema = z.string().uuid();
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Price must be a non-negative decimal");
const imageReferenceSchema = z
  .object({
    storageKey: z.string().trim().min(1).max(512),
    url: z.string().trim().url().max(2_048),
  })
  .strict();
const createProductSchema = z
  .object({
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/),
    description: z.string().trim().min(1).max(10_000),
    image: imageReferenceSchema,
    name: z.string().trim().min(1).max(200),
    price: moneySchema,
    sku: z.string().trim().min(1).max(64),
    status: z.enum(PRODUCT_STATUSES).default("INACTIVE"),
  })
  .strict();
const updateProductSchema = z
  .object({
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
    description: z.string().trim().min(1).max(10_000).optional(),
    image: imageReferenceSchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    price: moneySchema.optional(),
    sku: z.string().trim().min(1).max(64).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const updateProductStatusSchema = z
  .object({ status: z.enum(PRODUCT_STATUSES) })
  .strict();

class ProductImageReferenceDto {
  @ApiProperty({ example: "products/example/cover.webp", maxLength: 512 })
  storageKey!: string;

  @ApiProperty({ example: "https://cdn.example.com/products/example/cover.webp" })
  url!: string;
}

class CreateProductRequestDto {
  @ApiProperty({ example: "NOTEBOOK-001", maxLength: 64 })
  sku!: string;

  @ApiProperty({ example: "Notebook Pro 14", maxLength: 200 })
  name!: string;

  @ApiProperty({ maxLength: 10_000 })
  description!: string;

  @ApiProperty({ example: "1299990.00", pattern: "^\\d{1,10}(?:\\.\\d{1,2})?$", type: String })
  price!: string;

  @ApiProperty({ example: "CLP", pattern: "^[A-Za-z]{3}$" })
  currency!: string;

  @ApiProperty({ type: ProductImageReferenceDto })
  image!: ProductImageReferenceDto;

  @ApiPropertyOptional({ default: "INACTIVE", enum: PRODUCT_STATUSES })
  status?: (typeof PRODUCT_STATUSES)[number];
}

class UpdateProductRequestDto {
  @ApiPropertyOptional({ maxLength: 64 })
  sku?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  name?: string;

  @ApiPropertyOptional({ maxLength: 10_000 })
  description?: string;

  @ApiPropertyOptional({ pattern: "^\\d{1,10}(?:\\.\\d{1,2})?$", type: String })
  price?: string;

  @ApiPropertyOptional({ pattern: "^[A-Za-z]{3}$" })
  currency?: string;

  @ApiPropertyOptional({ type: ProductImageReferenceDto })
  image?: ProductImageReferenceDto;
}

class UpdateProductStatusRequestDto {
  @ApiProperty({ enum: PRODUCT_STATUSES })
  status!: (typeof PRODUCT_STATUSES)[number];
}

class AdministrativeProductResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: "1299990.00", type: String }) price!: string;
  @ApiProperty({ example: "CLP" }) currency!: string;
  @ApiProperty({ type: ProductImageReferenceDto }) image!: ProductImageReferenceDto;
  @ApiProperty({ enum: PRODUCT_STATUSES }) status!: (typeof PRODUCT_STATUSES)[number];
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
  @ApiProperty({ format: "date-time", nullable: true, type: String }) deletedAt!: string | null;
}

@ApiTags("products")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "ADMIN role required" })
@Controller("products")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN")
export class ProductAdministrationController {
  constructor(
    @Inject(ProductAdministrationService)
    private readonly products: ProductAdministrationService,
  ) {}

  @Post()
  @ApiOperation({ operationId: "createProduct", summary: "Create a product" })
  @ApiCreatedResponse({ type: AdministrativeProductResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product data" })
  @ApiConflictResponse({ description: "Duplicate SKU or image reference" })
  create(
    @Body() body: CreateProductRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdministrativeProduct> {
    return this.products.create(this.parse(createProductSchema, body), actor.id);
  }

  @Patch(":productId")
  @ApiOperation({ operationId: "updateProduct", summary: "Update a product" })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiOkResponse({ type: AdministrativeProductResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product data" })
  @ApiConflictResponse({ description: "Duplicate SKU or image reference" })
  @ApiNotFoundResponse({ description: "Product not found" })
  update(
    @Param("productId") productId: string,
    @Body() body: UpdateProductRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdministrativeProduct> {
    return this.products.update(
      this.parse(uuidSchema, productId),
      this.parse(updateProductSchema, body),
      actor.id,
    );
  }

  @Patch(":productId/status")
  @ApiOperation({ operationId: "updateProductStatus", summary: "Activate or deactivate a product" })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiOkResponse({ type: AdministrativeProductResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product status" })
  @ApiNotFoundResponse({ description: "Product not found" })
  updateStatus(
    @Param("productId") productId: string,
    @Body() body: UpdateProductStatusRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AdministrativeProduct> {
    const input = this.parse(updateProductStatusSchema, body);
    return this.products.updateStatus(
      this.parse(uuidSchema, productId),
      input.status,
      actor.id,
    );
  }

  @Delete(":productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteProduct", summary: "Soft-delete a product" })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiNoContentResponse({ description: "Product deleted logically" })
  @ApiNotFoundResponse({ description: "Product not found" })
  async delete(
    @Param("productId") productId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.products.delete(this.parse(uuidSchema, productId), actor.id);
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
