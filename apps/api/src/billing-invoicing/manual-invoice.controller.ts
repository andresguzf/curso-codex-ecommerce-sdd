import { BadRequestException, Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization/index.js";
import { InvoiceResponseDto } from "./invoice-response.dto.js";
import {
  ManualInvoiceService,
  manualInvoiceRequestSchema,
} from "./manual-invoice.service.js";

class ManualInvoiceLineRequestDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true, required: false })
  productId?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 64 })
  sku?: string | null;

  @ApiProperty({ required: false, maxLength: 200 })
  name?: string;

  @ApiProperty({ required: false, maxLength: 5_000 })
  description?: string;

  @ApiProperty({ type: "integer", minimum: 1, maximum: 1_000_000 })
  quantity!: number;

  @ApiProperty({ pattern: "^\\d{1,12}\\.\\d{2}$", example: "100.00" })
  unitPrice!: string;

  @ApiProperty({ pattern: "^(?:(?:[0-9]{1,2}|0[0-9]{2})\\.[0-9]{4}|100\\.0000)$", example: "19.0000", description: "Percentage from 0 to 100 inclusive, with four decimal places" })
  taxRate!: string;
}

class CreateManualInvoiceRequestDto {
  @ApiProperty({ format: "uuid" })
  customerId!: string;

  @ApiProperty({ required: false, default: "0.00", pattern: "^\\d{1,12}\\.\\d{2}$" })
  shippingTotal?: string;

  @ApiProperty({ type: [ManualInvoiceLineRequestDto], minItems: 1, maxItems: 100 })
  lines!: ManualInvoiceLineRequestDto[];
}

@ApiTags("invoices")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "Only Admin or Billing can create manual invoices" })
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN", "BILLING")
@Controller("invoices")
export class ManualInvoiceController {
  constructor(@Inject(ManualInvoiceService) private readonly service: ManualInvoiceService) {}

  @Post()
  @ApiOperation({
    operationId: "createManualInvoice",
    summary: "Create a manual draft invoice without an order or inventory changes",
  })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({ description: "Invalid customer, line or amount input" })
  @ApiNotFoundResponse({ description: "Active customer or referenced product not found" })
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: CreateManualInvoiceRequestDto,
  ) {
    const parsed = manualInvoiceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid manual invoice request",
        details: parsed.error.flatten(),
      });
    }
    return this.service.create(actor, parsed.data);
  }
}
