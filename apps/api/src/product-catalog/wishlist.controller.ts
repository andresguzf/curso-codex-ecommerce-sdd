import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Inject, NotFoundException, Param, Post, Query, UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiForbiddenResponse, ApiNoContentResponse,
  ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty,
  ApiQuery, ApiTags, ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization/index.js";
import { WishlistProductUnavailableError, WishlistRepository, type WishlistListQuery, type WishlistPage } from "./wishlist.repository.js";

const identifierSchema = z.uuid();
const listSchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(200).optional(),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional(),
  sortBy: z.enum(["createdAt", "name", "price"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).strict();
const addSchema = z.object({ productId: identifierSchema }).strict();

function parse<Schema extends z.ZodType>(schema: Schema, value: unknown): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException({
    code: "REQUEST_VALIDATION_FAILED", message: "The request is invalid",
    details: result.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
  });
  return result.data;
}

function notFound(): NotFoundException {
  return new NotFoundException({ code: "WISHLIST_ITEM_NOT_FOUND", message: "Wishlist item not found" });
}

class WishlistImageDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
}
class WishlistProductDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) slug!: string | null;
  @ApiProperty({ example: "99.00", type: String }) price!: string;
  @ApiProperty({ enum: ["USD"] }) currency!: "USD";
  @ApiProperty({ type: WishlistImageDto, nullable: true }) image!: WishlistImageDto | null;
  @ApiProperty({ minimum: 0 }) stockAvailable!: number;
  @ApiProperty() isAvailable!: boolean;
}
class WishlistItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ enum: ["ACTIVE", "INACTIVE"] }) productStatus!: "ACTIVE" | "INACTIVE";
  @ApiProperty({ format: "date-time", nullable: true, type: String }) productDeletedAt!: string | null;
  @ApiProperty({ type: WishlistProductDto }) product!: WishlistProductDto;
}
class WishlistPageDto {
  @ApiProperty({ type: [WishlistItemDto] }) items!: WishlistItemDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}
class AddWishlistItemDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
}
class WishlistAddResultDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ description: "False when the product was already saved" }) added!: boolean;
}

@ApiTags("wishlist")
@ApiBearerAuth("access-token")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("CUSTOMER")
@Controller("wishlist")
export class WishlistController {
  constructor(@Inject(WishlistRepository) private readonly wishlist: WishlistRepository) {}

  @Get()
  @ApiOperation({ operationId: "listWishlist", summary: "List the current customer's wishlist" })
  @ApiOkResponse({ type: WishlistPageDto })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String, description: "Literal match on saved product name or SKU" })
  @ApiQuery({ name: "availability", required: false, enum: ["AVAILABLE", "UNAVAILABLE"] })
  @ApiQuery({ name: "sortBy", required: false, enum: ["createdAt", "name", "price"] })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiBadRequestResponse({ description: "Invalid wishlist query" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "CUSTOMER role required" })
  list(@Query() query: Record<string, unknown>, @CurrentUser() customer: AuthenticatedUser): Promise<WishlistPage> {
    const parsed = parse(listSchema, query) as WishlistListQuery;
    return this.wishlist.listForCustomer(customer.id, parsed);
  }

  @Post("items")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "addWishlistItem", summary: "Save a product to the current customer's wishlist" })
  @ApiOkResponse({ type: WishlistAddResultDto })
  @ApiBadRequestResponse({ description: "Invalid product identifier" })
  @ApiNotFoundResponse({ description: "Active product not found" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "CUSTOMER role required" })
  async add(@Body() body: AddWishlistItemDto, @CurrentUser() customer: AuthenticatedUser): Promise<{ productId: string; added: boolean }> {
    const { productId } = parse(addSchema, body);
    try {
      return { productId, added: await this.wishlist.addItem(customer.id, productId) };
    } catch (error) {
      if (error instanceof WishlistProductUnavailableError) {
        throw new NotFoundException({ code: "PRODUCT_NOT_FOUND", message: "Product not found" });
      }
      throw error;
    }
  }

  @Delete("items/:productId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "removeWishlistItem", summary: "Remove a product from the current customer's wishlist" })
  @ApiParam({ name: "productId", format: "uuid" })
  @ApiNoContentResponse({ description: "Wishlist item removed" })
  @ApiBadRequestResponse({ description: "Invalid product identifier" })
  @ApiNotFoundResponse({ description: "Wishlist item not found for this customer" })
  @ApiUnauthorizedResponse({ description: "Authentication required" })
  @ApiForbiddenResponse({ description: "CUSTOMER role required" })
  async remove(@Param("productId") rawProductId: string, @CurrentUser() customer: AuthenticatedUser): Promise<void> {
    const productId = parse(identifierSchema, rawProductId);
    if (!await this.wishlist.removeItem(customer.id, productId)) throw notFound();
  }
}
