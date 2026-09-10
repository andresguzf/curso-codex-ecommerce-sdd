import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
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

import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  AuthenticationGuard,
  CurrentUser,
  Roles,
  RolesGuard,
} from "../identity-access/authorization";
import {
  INVOICE_ORIGINS,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "./invoice.aggregate";
import { InvoiceLifecycleService } from "./invoice-lifecycle.service";
import { InvoiceQueryService } from "./invoice-query.service";
import { InvoiceResponseDto } from "./invoice-response.dto";

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(200).optional(),
    customerId: z.uuid().optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    origin: z.enum(INVOICE_ORIGINS).optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
    sortBy: z
      .enum(["createdAt", "number", "total", "status", "origin"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (query) =>
      !query.createdFrom ||
      !query.createdTo ||
      Date.parse(query.createdFrom) <= Date.parse(query.createdTo),
    { message: "createdFrom must not be after createdTo" },
  );

class InvoiceStatusRequestDto {
  @ApiProperty({ enum: INVOICE_STATUSES })
  status!: InvoiceStatus;
}

class InvoiceSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ type: String, nullable: true }) number!: string | null;
  @ApiProperty({ enum: INVOICE_ORIGINS }) origin!: string;
  @ApiProperty({ enum: INVOICE_STATUSES }) status!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) orderId!: string | null;
  @ApiProperty({ format: "uuid" }) customerId!: string;
  @ApiProperty({ type: String, format: "uuid", nullable: true }) createdByUserId!: string | null;
  @ApiProperty({ enum: ["USD"] }) currency!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() shippingTotal!: string;
  @ApiProperty() taxTotal!: string;
  @ApiProperty() total!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) issuerSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: Object, additionalProperties: true }) customerSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) issuedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) dueAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) paidAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) voidedAt!: string | null;
}

class InvoicePageDto {
  @ApiProperty({ type: [InvoiceSummaryDto] })
  items!: InvoiceSummaryDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

@ApiTags("invoices")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "Role is not allowed for this operation" })
@UseGuards(AuthenticationGuard, RolesGuard)
@Controller("invoices")
export class InvoiceController {
  constructor(
    @Inject(InvoiceQueryService) private readonly queries: InvoiceQueryService,
    @Inject(InvoiceLifecycleService)
    private readonly lifecycle: InvoiceLifecycleService,
  ) {}

  @Get()
  @Roles("CUSTOMER", "ADMIN", "BILLING")
  @ApiOperation({
    operationId: "listInvoices",
    summary: "Search and paginate invoices; customers only see their own",
  })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1, maximum: 1_000_000 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "customerId", required: false, format: "uuid" })
  @ApiQuery({ name: "status", required: false, enum: INVOICE_STATUSES })
  @ApiQuery({ name: "origin", required: false, enum: INVOICE_ORIGINS })
  @ApiQuery({ name: "createdFrom", required: false, format: "date-time" })
  @ApiQuery({ name: "createdTo", required: false, format: "date-time" })
  @ApiQuery({ name: "sortBy", required: false, enum: ["createdAt", "number", "total", "status", "origin"] })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiOkResponse({ type: InvoicePageDto })
  list(@CurrentUser() actor: AuthenticatedUser, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid invoice query",
      });
    }
    return this.queries.list(actor, parsed.data);
  }

  @Get(":invoiceId")
  @Roles("CUSTOMER", "ADMIN", "BILLING")
  @ApiOperation({
    operationId: "getInvoice",
    summary: "Get an invoice; customers only see their own",
  })
  @ApiParam({ name: "invoiceId", format: "uuid" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({ description: "Invalid invoice identifier" })
  @ApiNotFoundResponse({ description: "Invoice not found" })
  detail(@CurrentUser() actor: AuthenticatedUser, @Param("invoiceId") invoiceId: string) {
    if (!z.uuid().safeParse(invoiceId).success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid invoice identifier",
      });
    }
    return this.queries.detail(actor, invoiceId);
  }

  @Patch(":invoiceId/status")
  @Roles("ADMIN", "BILLING")
  @ApiOperation({
    operationId: "changeInvoiceStatus",
    summary: "Transition an invoice status as Admin or Billing",
  })
  @ApiParam({ name: "invoiceId", format: "uuid" })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiBadRequestResponse({ description: "Invalid invoice status request" })
  @ApiConflictResponse({ description: "Invalid invoice state transition" })
  @ApiNotFoundResponse({ description: "Invoice not found" })
  changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("invoiceId") invoiceId: string,
    @Body() body: InvoiceStatusRequestDto,
  ) {
    const parsed = z.object({ status: z.enum(INVOICE_STATUSES) }).strict().safeParse(body);
    if (!z.uuid().safeParse(invoiceId).success || !parsed.success) {
      throw new BadRequestException({
        code: "REQUEST_VALIDATION_FAILED",
        message: "Invalid invoice status request",
      });
    }
    return this.lifecycle.transition(actor, invoiceId, parsed.data.status);
  }
}
