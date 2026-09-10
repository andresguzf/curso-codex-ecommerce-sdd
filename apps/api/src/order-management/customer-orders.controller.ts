import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Query, StreamableFile, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse, ApiNotFoundResponse,
  ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiQuery, ApiTags, ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { z } from "zod";

import type { AuthenticatedUser } from "../identity-access/auth.types";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization";
import { DocumentExportService } from "../document-export/document-export.service";
import type { OrderSnapshot } from "./order.aggregate";
import { ORDER_STATUSES, type OrderStatus } from "./order.aggregate";
import { CustomerOrdersService } from "./customer-orders.service";
import { OrderAdministrationService } from "./order-administration.service";
import { OrderCancellationService } from "./order-cancellation.service";

class CancelOrderRequestDto {
  @ApiProperty({ minLength: 1, maxLength: 500, description: "Required reason; the first successful cancellation preserves its reason and actor" }) reason!: string;
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
}).strict();

const administrativeQuerySchema = querySchema.extend({
  customerId: z.uuid().optional(), search: z.string().trim().min(1).max(200).optional(),
  createdFrom: z.iso.datetime({ offset: true }).optional(), createdTo: z.iso.datetime({ offset: true }).optional(),
  invoicing: z.enum(["ACTIVE_INVOICE", "NO_ACTIVE_INVOICE"]).optional(),
  sortBy: z.enum(["createdAt", "number", "total", "status"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
}).refine((q) => !q.createdFrom || !q.createdTo || Date.parse(q.createdFrom) <= Date.parse(q.createdTo));

class OrderStatusRequestDto {
  @ApiProperty({ enum: ORDER_STATUSES, description: "Only COMPLETED is accepted here; invoice and cancellation require dedicated workflows" }) status!: OrderStatus;
}

class CustomerOrderSummaryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() number!: string;
  @ApiProperty({ enum: ORDER_STATUSES }) status!: OrderStatus;
  @ApiProperty({ enum: ["USD"] }) currency!: string;
  @ApiProperty() subtotal!: string;
  @ApiProperty() shippingTotal!: string;
  @ApiProperty() taxTotal!: string;
  @ApiProperty() total!: string;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true }) cancelledAt!: string | null;
}

class CustomerOrderLineDto {
  @ApiProperty({ format: "uuid" }) productId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ minimum: 1 }) quantity!: number;
  @ApiProperty() unitPrice!: string;
  @ApiProperty() taxAmount!: string;
  @ApiProperty() lineTotal!: string;
  @ApiProperty({ enum: ["USD"] }) currency!: string;
}

class CustomerOrderDetailDto extends CustomerOrderSummaryDto {
  @ApiProperty({ type: Object, additionalProperties: true }) customerSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: Object, additionalProperties: true }) shippingAddressSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: Object, additionalProperties: true }) shippingMethodSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: Object, additionalProperties: true }) paymentSnapshot!: Record<string, unknown>;
  @ApiProperty({ type: [CustomerOrderLineDto] }) items!: CustomerOrderLineDto[];
}

class CustomerOrderPageDto {
  @ApiProperty({ type: [CustomerOrderSummaryDto] }) items!: CustomerOrderSummaryDto[];
  @ApiProperty({ minimum: 1 }) page!: number;
  @ApiProperty({ minimum: 1, maximum: 100 }) pageSize!: number;
  @ApiProperty({ minimum: 0 }) totalItems!: number;
  @ApiProperty({ minimum: 0 }) totalPages!: number;
}

class AdministrativeOrderSummaryDto extends CustomerOrderSummaryDto {
  @ApiProperty({ format: "uuid" }) customerId!: string;
  @ApiProperty({ type: Object, additionalProperties: true }) customerSnapshot!: Record<string, unknown>;
}
class AdministrativeOrderPageDto extends CustomerOrderPageDto {
  @ApiProperty({ type: [AdministrativeOrderSummaryDto] }) declare items: AdministrativeOrderSummaryDto[];
}

@ApiTags("orders")
@ApiBearerAuth("access-token")
@ApiUnauthorizedResponse({ description: "Invalid or expired session" })
@ApiForbiddenResponse({ description: "Role is not allowed for this operation" })
@ApiBadRequestResponse({ description: "Invalid identifier or query" })
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("CUSTOMER")
@Controller("orders")
export class CustomerOrdersController {
  constructor(
    @Inject(CustomerOrdersService) private readonly service: CustomerOrdersService,
    @Inject(OrderAdministrationService) private readonly administration: OrderAdministrationService,
    @Inject(OrderCancellationService) private readonly cancellation: OrderCancellationService,
    @Inject(DocumentExportService) private readonly documents: DocumentExportService,
  ) {}

  @Post(":orderId/cancel")
  @HttpCode(200)
  @Roles("ADMIN", "BILLING")
  @ApiOperation({ operationId: "cancelOrder", summary: "Allow Admin or Billing to cancel an eligible order and restore consumed stock exactly once; active invoices must be voided first" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ type: CustomerOrderSummaryDto, description: "Cancelled order, including unchanged results on retries" })
  @ApiConflictResponse({ description: "Invalid state, active invoice, or stock overflow" })
  @ApiNotFoundResponse({ description: "Order not found" })
  cancel(@CurrentUser() actor: AuthenticatedUser, @Param("orderId") orderId: string, @Body() body: CancelOrderRequestDto) {
    return this.cancellation.cancel(actor, orderId, body);
  }

  @Get()
  @Roles("ADMIN", "BILLING")
  @ApiOperation({ operationId: "administrativeOrders", summary: "Search and paginate orders for Admin and Billing" })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1, maximum: 1_000_000 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiQuery({ name: "search", required: false, type: String, description: "Literal search over order number and historical customer name/email" })
  @ApiQuery({ name: "customerId", required: false, format: "uuid" })
  @ApiQuery({ name: "status", required: false, enum: ORDER_STATUSES })
  @ApiQuery({ name: "createdFrom", required: false, format: "date-time" })
  @ApiQuery({ name: "createdTo", required: false, format: "date-time" })
  @ApiQuery({ name: "invoicing", required: false, enum: ["ACTIVE_INVOICE", "NO_ACTIVE_INVOICE"] })
  @ApiQuery({ name: "sortBy", required: false, enum: ["createdAt", "number", "total", "status"] })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @ApiOkResponse({ type: AdministrativeOrderPageDto })
  administrativeList(@CurrentUser() actor: AuthenticatedUser, @Query() query: unknown) {
    const parsed = administrativeQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Invalid order query" });
    return this.administration.list(actor, parsed.data);
  }

  @Patch(":orderId/status")
  @Roles("ADMIN", "BILLING")
  @ApiOperation({ operationId: "changeOrderStatus", summary: "Allow Admin or Billing to complete an invoiced order without changing stock or payment" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ type: CustomerOrderSummaryDto })
  @ApiConflictResponse({ description: "Invalid transition or dedicated workflow required" })
  @ApiNotFoundResponse({ description: "Order not found" })
  changeStatus(@CurrentUser() actor: AuthenticatedUser, @Param("orderId") orderId: string, @Body() body: OrderStatusRequestDto) {
    const parsed = z.object({ status: z.enum(ORDER_STATUSES) }).strict().safeParse(body);
    if (!z.uuid().safeParse(orderId).success || !parsed.success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Invalid order status request" });
    return this.administration.changeStatus(actor, orderId, parsed.data.status);
  }

  @Get("mine")
  @ApiOperation({ operationId: "customerOrders", summary: "List own orders, newest first with stable ID tie-breaker" })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1, maximum: 1_000_000, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, type: Number, minimum: 1, maximum: 100, example: 20 })
  @ApiQuery({ name: "status", required: false, enum: ORDER_STATUSES })
  @ApiOkResponse({ type: CustomerOrderPageDto })
  list(@CurrentUser() customer: AuthenticatedUser, @Query() query: unknown) {
    const parsed = querySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Invalid order query" });
    return this.service.list(customer.id, parsed.data);
  }

  @Get(":orderId")
  @Roles("CUSTOMER", "ADMIN", "BILLING")
  @ApiOperation({ operationId: "customerOrderDetail", summary: "Read historical detail: own order for Customer, any order for Admin or Billing" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ type: CustomerOrderDetailDto })
  @ApiNotFoundResponse({ description: "Order missing or not owned by the customer" })
  detail(@CurrentUser() customer: AuthenticatedUser, @Param("orderId") orderId: string) {
    if (!z.uuid().safeParse(orderId).success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Invalid order identifier" });
    return this.service.detail(customer, orderId);
  }

  @Get(":orderId/pdf")
  @Roles("CUSTOMER", "ADMIN", "BILLING")
  @ApiOperation({ operationId: "downloadOrderPdf", summary: "Download an authorized order PDF generated from historical snapshots" })
  @ApiParam({ name: "orderId", format: "uuid" })
  @ApiOkResponse({ description: "Order PDF", content: { "application/pdf": { schema: { type: "string", format: "binary" } } } })
  @ApiNotFoundResponse({ description: "Order missing or not owned by the customer" })
  @ApiBadRequestResponse({ description: "Invalid order identifier" })
  async downloadPdf(@CurrentUser() actor: AuthenticatedUser, @Param("orderId") orderId: string): Promise<StreamableFile> {
    if (!z.uuid().safeParse(orderId).success) throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Invalid order identifier" });
    const detail = await this.service.detail(actor, orderId);
    const customerSnapshot = detail.customerSnapshot as OrderSnapshot["customerSnapshot"];
    const snapshot: OrderSnapshot = {
      ...detail,
      customerId: customerSnapshot.id,
      customerSnapshot,
      currency: detail.currency as "USD",
      shippingAddressSnapshot: detail.shippingAddressSnapshot as OrderSnapshot["shippingAddressSnapshot"],
      shippingMethodSnapshot: detail.shippingMethodSnapshot as OrderSnapshot["shippingMethodSnapshot"],
      paymentSnapshot: detail.paymentSnapshot as OrderSnapshot["paymentSnapshot"],
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
      cancelledAt: detail.cancelledAt?.toISOString() ?? null,
      items: detail.items.map((item) => ({ ...item, currency: item.currency as "USD" })),
    };
    return new StreamableFile(this.documents.renderOrder(snapshot), { type: "application/pdf", disposition: `attachment; filename="order-${orderId}.pdf"` });
  }
}
