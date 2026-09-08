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
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import { CartService } from "./cart.service";
import type { ActiveCart } from "./cart.types";

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
  @ApiProperty({ example: "CLP" }) currency!: string;
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
  @ApiProperty({ format: "uuid" }) customerId!: string;
  @ApiProperty({ enum: ["ACTIVE"] }) status!: "ACTIVE";
  @ApiProperty({ type: [CartItemDto] }) items!: CartItemDto[];
  @ApiProperty({ minimum: 0 }) totalQuantity!: number;
  @ApiProperty({ example: "CLP", nullable: true, type: String })
  currency!: string | null;
  @ApiProperty({ example: "2599980.00", type: String }) subtotal!: string;
  @ApiProperty({ example: "2599980.00", type: String }) total!: string;
  @ApiProperty({ format: "date-time" }) createdAt!: string;
  @ApiProperty({ format: "date-time" }) updatedAt!: string;
}

class AddCartItemRequestDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty({ maximum: 2_147_483_647, minimum: 1 }) quantity!: number;
}

class UpdateCartItemRequestDto {
  @ApiProperty({ maximum: 2_147_483_647, minimum: 1 }) quantity!: number;
}

@ApiTags("cart")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "CUSTOMER role required" })
@Controller("cart")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("CUSTOMER")
export class CartController {
  constructor(@Inject(CartService) private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ operationId: "getCart", summary: "Read the active cart" })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  get(@CurrentUser() customer: AuthenticatedUser): Promise<ActiveCart> {
    return this.cart.get(customer.id);
  }

  @Post("items")
  @ApiOperation({ operationId: "addCartItem", summary: "Add a product to the active cart" })
  @ApiCreatedResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid product or quantity" })
  @ApiConflictResponse({ description: "Product unavailable or insufficient stock" })
  addItem(
    @Body() body: AddCartItemRequestDto,
    @CurrentUser() customer: AuthenticatedUser,
  ): Promise<ActiveCart> {
    const input = this.parse(addCartItemSchema, body);
    return this.cart.addItem(customer.id, input);
  }

  @Patch("items/:itemId")
  @ApiOperation({ operationId: "updateCartItem", summary: "Change a cart item quantity" })
  @ApiParam({ format: "uuid", name: "itemId" })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid item or quantity" })
  @ApiConflictResponse({ description: "Product unavailable or insufficient stock" })
  @ApiNotFoundResponse({ description: "Cart item not found in the customer's cart" })
  updateItem(
    @Param("itemId") itemId: string,
    @Body() body: UpdateCartItemRequestDto,
    @CurrentUser() customer: AuthenticatedUser,
  ): Promise<ActiveCart> {
    const input = this.parse(updateCartItemSchema, body);
    return this.cart.updateItem(
      customer.id,
      this.parse(uuidSchema, itemId),
      input.quantity,
    );
  }

  @Delete("items/:itemId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: "removeCartItem", summary: "Remove a cart item" })
  @ApiParam({ format: "uuid", name: "itemId" })
  @ApiOkResponse({ type: ActiveCartResponseDto })
  @ApiBadRequestResponse({ description: "Invalid item identifier" })
  @ApiNotFoundResponse({ description: "Cart item not found in the customer's cart" })
  removeItem(
    @Param("itemId") itemId: string,
    @CurrentUser() customer: AuthenticatedUser,
  ): Promise<ActiveCart> {
    return this.cart.removeItem(
      customer.id,
      this.parse(uuidSchema, itemId),
    );
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
