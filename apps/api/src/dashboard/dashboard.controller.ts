import { Controller, Get, Header, Inject, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import type { ApiResponseSchemaHost } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import { AuthenticationGuard, CurrentUser, Roles, RolesGuard } from "../identity-access/authorization";
import { DashboardSummaryService } from "./dashboard-summary.service";

const metric = (description: string) => ({ type: "integer" as const, minimum: 0, description });
const dateTime = { type: "string" as const, format: "date-time" };
const adminMetrics = {
  totalCustomers: metric("Non-deleted CUSTOMER accounts, including inactive or blocked accounts"),
  activeProducts: metric("Active, non-deleted products"),
  lowStockProducts: metric("Active products with available stock <= lowStockThreshold, including zero or missing balances"),
  processingOrders: metric("All orders in PROCESSING"),
  pendingInvoices: metric("All invoices in PENDING_PAYMENT, independent of age or origin"),
};
const billingMetrics = {
  ordersEligibleForInvoicing: metric("PROCESSING orders without a non-VOID invoice and with a recorded payment; conversion revalidates transactionally"),
  ordersAwaitingInvoice: metric("PROCESSING orders without a non-VOID invoice, even if payment is missing"),
  pendingInvoices: adminMetrics.pendingInvoices,
  paidInvoices: metric("Invoices currently PAID whose paidAt falls in the inclusive rolling 30-day period"),
};
export const dashboardResponseSchema: ApiResponseSchemaHost["schema"] = {
  oneOf: [
    { type: "object" as const, additionalProperties: false, required: ["role", "updatedAt", "lowStockThreshold", "metrics"], properties: {
      role: { type: "string" as const, enum: ["ADMIN"] }, updatedAt: dateTime,
      lowStockThreshold: { type: "integer" as const, enum: [5] },
      metrics: { type: "object" as const, additionalProperties: false, required: Object.keys(adminMetrics), properties: adminMetrics },
    } },
    { type: "object" as const, additionalProperties: false, required: ["role", "updatedAt", "period", "metrics"], properties: {
      role: { type: "string" as const, enum: ["BILLING"] }, updatedAt: dateTime,
      period: { type: "object" as const, additionalProperties: false, required: ["from", "to", "basis"], properties: {
        from: dateTime, to: dateTime, basis: { type: "string" as const, enum: ["paidAt"] },
      } },
      metrics: { type: "object" as const, additionalProperties: false, required: Object.keys(billingMetrics), properties: billingMetrics },
    } },
  ],
};

@ApiTags("dashboard")
@ApiBearerAuth("access-token")
@UseGuards(AuthenticationGuard, RolesGuard)
@Roles("ADMIN", "BILLING")
@Controller("dashboard")
export class DashboardController {
  constructor(@Inject(DashboardSummaryService) private readonly service: DashboardSummaryService) {}

  @Get("summary")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ operationId: "dashboardSummary", summary: "Role-specific administrative counts from a single read-only database snapshot" })
  @ApiOkResponse({ schema: dashboardResponseSchema })
  @ApiUnauthorizedResponse({ description: "Invalid or expired session" })
  @ApiForbiddenResponse({ description: "CUSTOMER has no access to administrative indicators" })
  summary(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.summary(actor);
  }
}
