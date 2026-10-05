import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DatabaseService } from "../database/database.service.js";
import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import { IdentitySummaryReader } from "../identity-access/identity-summary.reader.js";
import { CatalogSummaryReader } from "../product-catalog/catalog-summary.reader.js";
import { InventorySummaryReader } from "../inventory-control/inventory-summary.reader.js";
import { OrderSummaryReader } from "../order-management/order-summary.reader.js";
import { BillingSummaryReader } from "../billing-invoicing/billing-summary.reader.js";

@Injectable()
export class DashboardSummaryService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(IdentitySummaryReader) private readonly identity: IdentitySummaryReader,
    @Inject(CatalogSummaryReader) private readonly catalog: CatalogSummaryReader,
    @Inject(InventorySummaryReader) private readonly inventory: InventorySummaryReader,
    @Inject(OrderSummaryReader) private readonly orders: OrderSummaryReader,
    @Inject(BillingSummaryReader) private readonly billing: BillingSummaryReader,
  ) {}

  summary(actor: AuthenticatedUser) {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") {
      throw new ForbiddenException({ code: "AUTH_FORBIDDEN", message: "You do not have permission to perform this operation" });
    }
    return this.database.client.transaction(async (transaction) => {
      const timestamp = await transaction.execute<{ updatedAt: Date }>(sql`select transaction_timestamp() as "updatedAt"`);
      const to = new Date(timestamp.rows[0]!.updatedAt);
      const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
      const period = { from: from.toISOString(), to: to.toISOString(), basis: "paidAt" as const };
      const orderCounts = await this.orders.read(transaction);
      const invoiceCounts = await this.billing.read(transaction, from, to);
      if (actor.role === "BILLING") {
        // Do not query restricted modules or spread administrative projections.
        return {
          role: "BILLING" as const, updatedAt: to.toISOString(), period,
          metrics: {
            ordersEligibleForInvoicing: orderCounts.ordersEligibleForInvoicing,
            ordersAwaitingInvoice: orderCounts.ordersAwaitingInvoice,
            pendingInvoices: invoiceCounts.pendingInvoices,
            paidInvoices: invoiceCounts.paidInvoices,
          },
        };
      }
      const lowStockThreshold = 5;
      return {
        role: "ADMIN" as const, updatedAt: to.toISOString(), lowStockThreshold,
        metrics: {
          totalCustomers: await this.identity.countCustomers(transaction),
          activeProducts: await this.catalog.countActiveProducts(transaction),
          lowStockProducts: await this.inventory.countLowStockProducts(transaction, lowStockThreshold),
          processingOrders: orderCounts.processingOrders,
          pendingInvoices: invoiceCounts.pendingInvoices,
        },
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
