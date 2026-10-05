import { CatalogImageDto } from "./catalog-image.dto.js";
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
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from "@nestjs/swagger";
import { z } from "zod";

import {
  type AuthenticatedRequest,
  OptionalAuthenticationGuard,
} from "../identity-access/authorization/index.js";
import { ProductAdministrationService } from "./product-administration.service.js";
import {
  PRODUCT_AVAILABILITIES,
  PRODUCT_LIST_VIEWS,
  PRODUCT_SORT_FIELDS,
  PRODUCT_STATUSES,
  type ProductDetail,
  type ProductPage,
} from "./product-administration.types.js";

const uuidSchema = z.string().uuid();
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(220);
const tagIdsSchema = z.string().transform((value) => value.split(",")).pipe(
  z.array(uuidSchema).min(1).max(20).refine((ids) => new Set(ids).size === ids.length),
);
const moneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const calendarDateSchema = z.iso.date();
const productListQuerySchema = z
  .object({
    purpose: z.literal("autocomplete").optional(),
    availability: z.enum(PRODUCT_AVAILABILITIES).optional(),
    categoryId: uuidSchema.optional(),
    tagIds: tagIdsSchema.optional(),
    createdFrom: calendarDateSchema.optional(),
    createdTo: calendarDateSchema.optional(),
    maxPrice: moneySchema.optional(),
    minPrice: moneySchema.optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    sortBy: z.enum(PRODUCT_SORT_FIELDS).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    status: z.enum(PRODUCT_STATUSES).optional(),
    view: z.enum(PRODUCT_LIST_VIEWS).default("public"),
  })
  .strict()
  .refine((query) => query.purpose !== "autocomplete" || (
    (query.search?.length ?? 0) >= 3 && query.pageSize <= 20 && query.view === "public" && !query.status
  ), { message: "Autocomplete requires search >= 3 characters, pageSize <= 20 and public active products" })
  .refine(
    ({ maxPrice, minPrice }) =>
      maxPrice === undefined ||
      minPrice === undefined ||
      Number(minPrice) <= Number(maxPrice),
  )
  .refine(
    ({ createdFrom, createdTo }) =>
      createdFrom === undefined ||
      createdTo === undefined ||
      createdFrom <= createdTo,
  )
  .refine(
    ({ createdFrom, createdTo, view }) =>
      (createdFrom === undefined && createdTo === undefined) ||
      view === "administrative",
  );
const productDetailQuerySchema = z
  .object({ view: z.enum(PRODUCT_LIST_VIEWS).default("public") })
  .strict();

class ProductListImageDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
}

class ProductClassificationDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] }) status!: "ACTIVE" | "INACTIVE";
}

export class ProductListItemDto {
  @ApiPropertyOptional({ type: Boolean, description: "ADMIN view only" }) isFeatured?: boolean;
  @ApiPropertyOptional({ type: String, nullable: true, format: "date-time", description: "ADMIN view only" }) featuredAt?: string | null;
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty({ nullable: true, type: String }) slug!: string | null;
  @ApiProperty({ nullable: true, type: "object", properties: { id: { type: "string", format: "uuid" }, name: { type: "string" }, slug: { type: "string" }, status: { type: "string", enum: ["ACTIVE", "INACTIVE"] } } }) category!: ProductClassificationDto | null;
  @ApiProperty({ type: [ProductClassificationDto] }) tags!: ProductClassificationDto[];
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ example: "1299990.00", type: String }) price!: string;
  @ApiProperty({ enum: ["USD"], example: "USD" }) currency!: "USD";
  @ApiProperty({ type: ProductListImageDto, deprecated: true, description: "Compatibility reference; use coverImage for new consumers. Local placeholder when a draft has no cover." }) image!: ProductListImageDto;
  @ApiProperty({
    required: true,
    description: "Primary image only; null when an administrative draft has no cover. Render the local placeholder when absent or loading fails.",
    oneOf: [
      { $ref: getSchemaPath(CatalogImageDto) },
      { type: "object", nullable: true, enum: [null] },
    ],
  }) coverImage!: CatalogImageDto | null;
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
  @ApiProperty({ type: [CatalogImageDto], description: "Full gallery ordered by sortOrder, without autoplay semantics" }) images!: CatalogImageDto[];
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
  @ApiQuery({ name: "purpose", required: false, enum: ["autocomplete"], description: "Authenticated ADMIN/BILLING lookup of active products. Requires search >= 3 characters; pageSize 1–20 (default 20), view=public and no status override. Out-of-stock products remain eligible for invoicing." })
  @ApiBadRequestResponse({ description: "Invalid query parameters" })
  @ApiUnauthorizedResponse({ description: "Administrative view and autocomplete require authentication" })
  @ApiForbiddenResponse({ description: "Administrative view requires ADMIN; autocomplete requires ADMIN or BILLING" })
  @ApiQuery({ enum: PRODUCT_LIST_VIEWS, name: "view", required: false })
  @ApiQuery({ name: "page", required: false, schema: { type: "integer", minimum: 1, maximum: 1_000_000, default: 1 } })
  @ApiQuery({ name: "pageSize", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, description: "Maximum 20 for purpose=autocomplete; maximum 100 otherwise" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "categoryId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "tagIds", required: false, type: String, description: "Comma-separated tag UUIDs; matches any selected tag" })
  @ApiQuery({ enum: PRODUCT_STATUSES, name: "status", required: false })
  @ApiQuery({
    enum: PRODUCT_AVAILABILITIES,
    name: "availability",
    required: false,
  })
  @ApiQuery({ name: "minPrice", required: false, type: String })
  @ApiQuery({ name: "maxPrice", required: false, type: String })
  @ApiQuery({ name: "createdFrom", required: false, type: String, format: "date", description: "Inclusive UTC creation date; administrative view only" })
  @ApiQuery({ name: "createdTo", required: false, type: String, format: "date", description: "Inclusive UTC creation date; administrative view only" })
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

  @Get("slug/:slug")
  @UseGuards(OptionalAuthenticationGuard)
  @ApiOperation({ operationId: "getProductBySlug", summary: "Read a public product detail by stable slug" })
  @ApiParam({ name: "slug", type: String })
  @ApiOkResponse({ type: ProductDetailResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product slug" })
  @ApiNotFoundResponse({ description: "Product not found or not publicly visible" })
  getBySlug(@Param("slug") slug: string): Promise<ProductDetail> {
    const result = slugSchema.safeParse(slug);
    if (!result.success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "The product slug is invalid" });
    return this.products.getPublicDetailBySlug(result.data);
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
