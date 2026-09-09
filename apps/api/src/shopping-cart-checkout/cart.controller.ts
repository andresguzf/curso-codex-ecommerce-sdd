import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  OptionalAuthenticationGuard,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import {
  ANONYMOUS_CART_COOKIE,
  AnonymousCartCookieService,
} from "./anonymous-cart-cookie.service";
import { CartService } from "./cart.service";
import type { ActiveCart, CartClaimResult, CartOwner } from "./cart.types";

type OptionalAuthenticatedRequest = FastifyRequest & {
  authUser?: AuthenticatedUser;
};

const uuidSchema = z.string().uuid();
const quantitySchema = z.number().int().min(1).max(2_147_483_647);
const addCartItemSchema = z
  .object({ productId: uuidSchema, quantity: quantitySchema })
  .strict();
const updateCartItemSchema = z.object({ quantity: quantitySchema }).strict();

class CartImageDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() url!: string;
}

class CartProductDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ example: "1299990.00", type: String }) price!: string;
  @ApiProperty({ enum: ["USD"], example: "USD" }) currency!: "USD";
  @ApiProperty({ type: CartImageDto }) image!: CartImageDto;
  @ApiProperty({ minimum: 0 }) stockAvailable!: number;
  @ApiProperty() isAvailable!: boolean;
}

class CartItemDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty({ example: "2599980.00", type: String }) subtotal!: string;
  @ApiProperty({ type: CartProductDto }) product!: CartProductDto;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

class ActiveCartResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "uuid", nullable: true, type: String })
  customerId!: string | null;
  @ApiProperty({ enum: ["ACTIVE"] }) status!: "ACTIVE";
  @ApiProperty({ type: [CartItemDto] }) items!: CartItemDto[];
  @ApiProperty({ minimum: 0 }) totalQuantity!: number;
  @ApiProperty({ enum: ["USD"], example: "USD", nullable: true, type: String })
  currency!: "USD" | null;
  @ApiProperty({ example: "2599980.00", type: String }) subtotal!: string;
  @ApiProperty({ example: "2599980.00", type: String }) total!: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

class CartClaimResponseDto {
  @ApiProperty({ type: ActiveCartResponseDto }) cart!: ActiveCartResponseDto;
  @ApiProperty({ format: "uuid", isArray: true }) adjustedProductIds!: string[];
}

class AddCartItemRequestDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ maximum: 2_147_483_647, minimum: 1 }) quantity!: number;
}

class UpdateCartItemRequestDto {
  @ApiProperty({ maximum: 2_147_483_647, minimum: 1 }) quantity!: number;
}

@ApiTags("cart")
@Controller("cart")
@UseGuards(OptionalAuthenticationGuard)
export class CartController {
  constructor(
    @Inject(CartService) private readonly cart: CartService,
    @Inject(AnonymousCartCookieService)
    private readonly anonymousCookie: AnonymousCartCookieService,
  ) {}

  @Get()
  @ApiOperation({
    operationId: "getCart",
    security: [
      {},
      { [ANONYMOUS_CART_COOKIE]: [] },
      { "access-token": [] },
    ],
    summary: "Read the active cart",
  })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  get(
    @Req() request: OptionalAuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ActiveCart> {
    return this.cart.get(this.resolveOwner(request, reply));
  }

  @Post("items")
  @ApiOperation({
    operationId: "addCartItem",
    security: [
      {},
      { [ANONYMOUS_CART_COOKIE]: [] },
      { "access-token": [] },
    ],
    summary: "Add a product to the active cart",
  })
  @ApiCreatedResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product or quantity" })
  @ApiConflictResponse({ description: "Product unavailable or insufficient stock" })
  addItem(
    @Body() body: AddCartItemRequestDto,
    @Req() request: OptionalAuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ActiveCart> {
    const input = this.parse(addCartItemSchema, body);
    return this.cart.addItem(this.resolveOwner(request, reply), input);
  }

  @Patch("items/:itemId")
  @ApiOperation({
    operationId: "updateCartItem",
    security: [
      {},
      { [ANONYMOUS_CART_COOKIE]: [] },
      { "access-token": [] },
    ],
    summary: "Change a cart item quantity",
  })
  @ApiParam({ format: "uuid", name: "itemId" })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid item or quantity" })
  @ApiConflictResponse({ description: "Product unavailable or insufficient stock" })
  @ApiNotFoundResponse({ description: "Cart item not found in the customer's cart" })
  updateItem(
    @Param("itemId") itemId: string,
    @Body() body: UpdateCartItemRequestDto,
    @Req() request: OptionalAuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ActiveCart> {
    const input = this.parse(updateCartItemSchema, body);
    return this.cart.updateItem(
      this.resolveOwner(request, reply),
      this.parse(uuidSchema, itemId),
      input.quantity,
    );
  }

  @Delete("items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: "removeCartItem",
    security: [
      {},
      { [ANONYMOUS_CART_COOKIE]: [] },
      { "access-token": [] },
    ],
    summary: "Remove a cart item",
  })
  @ApiParam({ format: "uuid", name: "itemId" })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid item identifier" })
  @ApiNotFoundResponse({ description: "Cart item not found in the customer's cart" })
  removeItem(
    @Param("itemId") itemId: string,
    @Req() request: OptionalAuthenticatedRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<ActiveCart> {
    return this.cart.removeItem(
      this.resolveOwner(request, reply),
      this.parse(uuidSchema, itemId),
    );
  }

  @Post("claim")
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthenticationGuard, RolesGuard)
  @Roles("CUSTOMER")
  @ApiOperation({
    operationId: "claimAnonymousCart",
    security: [{ "access-token": [] }],
    summary: "Claim or merge the browser's anonymous cart",
  })
  @ApiOkResponse({ type: CartClaimResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid or expired session" })
  @ApiForbiddenResponse({ description: "CUSTOMER role required" })
  async claim(
    @CurrentUser() customer: AuthenticatedUser,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<CartClaimResult> {
    const result = await this.cart.claimAnonymousCart(
      customer.id,
      this.anonymousCookie.hashFromRequest(request),
    );
    this.anonymousCookie.clear(reply);
    return result;
  }

  private resolveOwner(
    request: OptionalAuthenticatedRequest,
    reply: FastifyReply,
  ): CartOwner {
    if (!request.authUser) return this.anonymousCookie.resolve(request, reply);
    if (request.authUser.role !== "CUSTOMER") {
      throw new ForbiddenException({
        code: "CART_CUSTOMER_REQUIRED",
        message: "Only customers can use an authenticated cart",
      });
    }
    return { customerId: request.authUser.id, kind: "customer" };
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
