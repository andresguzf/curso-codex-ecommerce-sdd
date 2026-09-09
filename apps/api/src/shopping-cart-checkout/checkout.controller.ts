import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Get,
  Param,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiProperty,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiParam,
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
import { CheckoutService } from "./checkout.service";
import type { CheckoutResult } from "./checkout.types";
import { PAYMENT_METHODS } from "./payment/payment.port";
import { SHIPPING_METHODS, ShippingQuoteProvider } from "./shipping/shipping.port";
import { SYSTEM_CURRENCY } from "../shared/system-currency";

const checkoutSchema = z
  .object({
    paymentMethod: z.enum(PAYMENT_METHODS),
    shippingMethod: z.enum(SHIPPING_METHODS),
    shippingAddress: z
      .object({
        recipientName: z.string().trim().min(1).max(120),
        line1: z.string().trim().min(1).max(200),
        line2: z.string().trim().min(1).max(200).optional(),
        city: z.string().trim().min(1).max(120),
        region: z.string().trim().min(1).max(120),
        postalCode: z.string().trim().min(1).max(32),
        countryCode: z.string().trim().regex(/^[A-Z]{2}$/),
      })
      .strict(),
  })
  .strict();
const idempotencyKeySchema = z.string().trim().min(8).max(200);

class CheckoutAddressDto {
  @ApiProperty() recipientName!: string;
  @ApiProperty() line1!: string;
  @ApiProperty({ required: false }) line2?: string;
  @ApiProperty() city!: string;
  @ApiProperty() region!: string;
  @ApiProperty() postalCode!: string;
  @ApiProperty({ example: "CL", pattern: "^[A-Z]{2}$" }) countryCode!: string;
}

class CheckoutRequestDto {
  @ApiProperty({ enum: PAYMENT_METHODS }) paymentMethod!: string;
  @ApiProperty({ enum: SHIPPING_METHODS }) shippingMethod!: string;
  @ApiProperty({ type: CheckoutAddressDto }) shippingAddress!: CheckoutAddressDto;
}

class CheckoutOrderItemDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty({ example: "100.00", type: String }) unitPrice!: string;
  @ApiProperty({ example: "0.00", type: String }) taxAmount!: string;
  @ApiProperty({ example: "200.00", type: String }) lineTotal!: string;
  @ApiProperty({ enum: ["USD"], example: "USD" }) currency!: "USD";
}

class CheckoutOrderDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() number!: string;
  @ApiProperty({ enum: ["PROCESSING"] }) status!: "PROCESSING";
  @ApiProperty({ enum: ["USD"] }) currency!: "USD";
  @ApiProperty({ type: String }) subtotal!: string;
  @ApiProperty({ type: String }) shippingTotal!: string;
  @ApiProperty({ type: String }) taxTotal!: string;
  @ApiProperty({ type: String }) total!: string;
  @ApiProperty({ type: [CheckoutOrderItemDto] }) items!: CheckoutOrderItemDto[];
  @ApiProperty({ format: "date-time" }) createdAt!: string;
}

class CheckoutPaymentDto {
  @ApiProperty({ enum: ["APPROVED"] }) status!: "APPROVED";
  @ApiProperty({ enum: PAYMENT_METHODS }) method!: string;
  @ApiProperty() providerReference!: string;
}

class CheckoutResponseDto {
  @ApiProperty({ type: CheckoutOrderDto }) order!: CheckoutOrderDto;
  @ApiProperty({ type: CheckoutPaymentDto }) payment!: CheckoutPaymentDto;
}

class CheckoutShippingOptionDto {
  @ApiProperty({ enum: SHIPPING_METHODS }) method!: string;
  @ApiProperty({ type: String, example: "5.00" }) cost!: string;
  @ApiProperty({ enum: ["USD"] }) currency!: "USD";
}

@ApiTags("checkout")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "CUSTOMER role required" })
@Controller("checkout")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("CUSTOMER")
export class CheckoutController {
  constructor(
    @Inject(CheckoutService) private readonly checkoutService: CheckoutService,
    @Inject(ShippingQuoteProvider) private readonly shipping: ShippingQuoteProvider,
  ) {}

  @Get("shipping-methods")
  @ApiOperation({ operationId: "checkoutShippingMethods", summary: "Read configured simulated shipping costs in USD" })
  @ApiOkResponse({ type: [CheckoutShippingOptionDto] })
  async shippingMethods(): Promise<CheckoutShippingOptionDto[]> {
    return Promise.all(SHIPPING_METHODS.map(async (method) => {
      const quote = await this.shipping.quote({
        currency: SYSTEM_CURRENCY,
        destination: { countryCode: "CL", postalCode: "0000000" },
        method,
      });
      return { method, cost: quote.cost, currency: SYSTEM_CURRENCY };
    }));
  }

  @Get("orders/:orderId")
  @ApiOperation({ operationId: "checkoutReceipt", summary: "Read the customer's immutable checkout confirmation" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ type: CheckoutResponseDto })
  @ApiNotFoundResponse({ description: "Receipt not found for this customer" })
  receipt(@Param("orderId") orderId: string, @CurrentUser() customer: AuthenticatedUser) {
    if (!z.uuid().safeParse(orderId).success) throw new BadRequestException({
      code: "REQUEST_VALIDATION_FAILED", message: "Invalid order identifier",
    });
    return this.checkoutService.getReceipt(customer.id, orderId);
  }

  @Post()
  @ApiOperation({
    operationId: "checkout",
    summary: "Confirm the active cart as an idempotent purchase",
  })
  @ApiHeader({
    description: "Unique key for this checkout attempt",
    name: "Idempotency-Key",
    required: true,
  })
  @ApiCreatedResponse({ type: CheckoutResponseDto })
  @ApiBadRequestResponse({ description: "Invalid request or idempotency key" })
  @ApiConflictResponse({
    description: "Cart, catalog, stock, payment, or idempotency conflict",
  })
  checkout(
    @Body() body: CheckoutRequestDto,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @CurrentUser() customer: AuthenticatedUser,
  ): Promise<CheckoutResult> {
    const request = checkoutSchema.safeParse(body);
    const key = idempotencyKeySchema.safeParse(idempotencyKey);
    if (!request.success || !key.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "The checkout request or Idempotency-Key header is invalid",
      });
    }

    return this.checkoutService.checkout(customer, request.data, key.data);
  }
}
