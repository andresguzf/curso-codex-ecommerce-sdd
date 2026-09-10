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

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import { InvoiceResponseDto } from "./invoice-response.dto";
import {
  ManualInvoiceService,
  manualInvoiceRequestSchema,
} from "./manual-invoice.service";

class ManualInvoiceLineRequestDto {
  @ApiProperty({ type: String, format: "uuid", nullable: true, required: false })
  productId?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 64 })
  sku?: string | null;

  @ApiProperty({ required: false, maxLength: 200 })
  name?: string;

  @ApiProperty({ required: false, maxLength: 5_000 })
  description?: string;

  @ApiProperty({ minimum: 1, maximum: 1_000_000 })
  quantity!: number;

  @ApiProperty({ pattern: "^\\d{1,12}\\.\\d{2}$", example: "100.00" })
  unitPrice!: string;

  @ApiProperty({ pattern: "^\\d{1,3}\\.\\d{4}$", example: "19.0000" })
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
