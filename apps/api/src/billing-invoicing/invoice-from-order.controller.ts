import { BadRequestException, Controller, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization";
import { InvoiceFromOrderService } from "./invoice-from-order.service";
import { InvoiceResponseDto } from "./invoice-response.dto";

@ApiTags("invoices", "orders")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "Only Admin or Billing can invoice orders" })
@ApiBadRequestResponse({ description: "Invalid order identifier" })
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN", "BILLING")
@Controller("orders")
export class InvoiceFromOrderController {
  constructor(@Inject(InvoiceFromOrderService) private readonly service: InvoiceFromOrderService) {}

  @Post(":orderId/invoice")
  @HttpCode(201)
  @ApiOperation({
    operationId: "invoiceOrder",
    summary: "Atomically create an invoice from an eligible order and mark it invoiced",
  })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiConflictResponse({ description: "Invalid order state, missing payment or existing active invoice" })
  @ApiNotFoundResponse({ description: "Order not found" })
  convert(@CurrentUser() actor: AuthenticatedUser, @Param("orderId") orderId: string) {
    if (!z.uuid().safeParse(orderId).success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid order identifier",
      });
    }
    return this.service.convert(actor, orderId);
  }
}
