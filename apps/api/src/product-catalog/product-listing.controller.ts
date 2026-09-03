import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import {
  type AuthenticatedRequest,
  OptionalAuthenticationGuard,
} from "../identity-access/authorization";
import { ProductAdministrationService } from "./product-administration.service";
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_LIST_VIEWS,
  PRODUCT_SORT_FIELDS,
  PRODUCT_STATUSES,
  type ProductDetail,
  type ProductPage,
} from "./product-administration.types";

const uuidSchema = z.string().uuid();
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const productListQuerySchema = z
  .object({
    availability: z.enum(PRODUCT_AVAILABILITIES).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).optional(),
    maxPrice: moneySchema.optional(),
    minPrice: moneySchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: z.enum(PRODUCT_STATUSES).optional(),
    view: z.enum(PRODUCT_LIST_VIEWS).default("public"),
  })
  .strict()
  .refine(
    ({ maxPrice, minPrice }) =>
      maxPrice === undefined ||
      minPrice === undefined ||
      Number(minPrice) <= Number(maxPrice),
  );
const productDetailQuerySchema = z
  .object({ view: z.enum(PRODUCT_LIST_VIEWS).default("public") })
  .strict();

class ProductListImageDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty({ format: "uri" }) url!: string;
}

class ProductListItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: "1299990.00", type: String }) price!: string;
  @ApiProperty({ example: "CLP" }) currency!: string;
  @ApiProperty({ type: ProductListImageDto }) image!: ProductListImageDto;
  @ApiProperty({ enum: PRODUCT_STATUSES }) status!: (typeof PRODUCT_STATUSES)[number];
  @ApiProperty({ minimum: 0 }) stockAvailable!: number;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

class ProductPageResponseDto {
  @ApiProperty({ type: [ProductListItemDto] }) items!: ProductListItemDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ maximum: 100, minimum: 1 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

class ProductDetailResponseDto extends ProductListItemDto {
  @ApiProperty({ enum: PRODUCT_AVAILABILITIES })
  availability!: (typeof PRODUCT_AVAILABILITIES)[number];
}

@ApiTags("products")
@Controller("products")
export class ProductListingController {
  constructor(
    @Inject(ProductAdministrationService)
    private readonly products: ProductAdministrationService,
  ) {}

  @Get()
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({
    operationId: "listProducts",
    summary: "List public or administrative products",
  })
  @ApiOkResponse({ type: ProductPageResponseDto })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  @ApiUnauthorizedResponse({ description: "Administrative view requires authentication" })
  @ApiForbiddenResponse({ description: "Administrative view requires ADMIN" })
  @ApiQuery({ enum: PRODUCT_LIST_VIEWS, name: "view", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ enum: PRODUCT_STATUSES, name: "status", required: false })
  @ApiQuery({
    enum: PRODUCT_AVAILABILITIES,
    name: "availability",
    required: false,
  })
  @ApiQuery({ name: "currency", required: false, type: String })
  @ApiQuery({ name: "minPrice", required: false, type: String })
  @ApiQuery({ name: "maxPrice", required: false, type: String })
  @ApiQuery({ enum: PRODUCT_SORT_FIELDS, name: "sortBy", required: false })
  @ApiQuery({ enum: ["asc", "desc"], name: "sortOrder", required: false })
  list(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProductPage> {
    const result = productListQuerySchema.safeParse(query);
    if (!result.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }

    return this.products.list(result.data, request.authUser);
  }

  @Get(":productId")
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({
    operationId: "getProduct",
    summary: "Read a public or administrative product detail",
  })
  @ApiParam({ format: "uuid", name: "productId" })
  @ApiQuery({ enum: PRODUCT_LIST_VIEWS, name: "view", required: false })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product identifier or view" })
  @ApiUnauthorizedResponse({ description: "Administrative view requires authentication" })
  @ApiForbiddenResponse({ description: "Administrative view requires ADMIN" })
  @ApiNotFoundResponse({ description: "Product not found or not publicly visible" })
  getDetail(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
    @Param("productId") productId: string,
  ): Promise<ProductDetail> {
    const parsedId = uuidSchema.safeParse(productId);
    const parsedQuery = productDetailQuerySchema.safeParse(query);
    if (!parsedId.success || !parsedQuery.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The request is invalid",
      });
    }

    return this.products.getDetail(
      parsedId.data,
      parsedQuery.data.view,
      request.authUser,
    );
  }
}
