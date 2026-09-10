import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq, exists, gte, ilike, lte, ne, not, or, sql } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { auditEntries, invoices, orders } from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import { assertOrderTransition, InvalidOrderTransitionError, type OrderStatus } from "./order.aggregate";
import { summaryColumns } from "./customer-orders.service";

export type AdministrativeOrderQuery = Readonly<{
  page: number; pageSize: number; search?: string; customerId?: string; status?: OrderStatus;
  createdFrom?: string; createdTo?: string; invoicing?: "ACTIVE_INVOICE" | "NO_ACTIVE_INVOICE";
  sortBy: "createdAt" | "number" | "total" | "status"; sortOrder: "asc" | "desc";
}>;

@Injectable()
export class OrderAdministrationService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(actor: AuthenticatedUser, query: AdministrativeOrderQuery) {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") throw new ForbiddenException();
    return this.database.client.transaction(async (transaction) => {
      const activeInvoice = exists(transaction.select({ id: invoices.id }).from(invoices)
        .where(and(eq(invoices.orderId, orders.id), ne(invoices.status, "VOID"))));
      const search = query.search ? `%${query.search.replace(/[\\%_]/g, "\\$&")}%` : undefined;
      const where = and(
        query.customerId ? eq(orders.customerId, query.customerId) : undefined,
        query.status ? eq(orders.status, query.status) : undefined,
        query.createdFrom ? gte(orders.createdAt, new Date(query.createdFrom)) : undefined,
        query.createdTo ? lte(orders.createdAt, new Date(query.createdTo)) : undefined,
        query.invoicing === "ACTIVE_INVOICE" ? activeInvoice : query.invoicing === "NO_ACTIVE_INVOICE" ? not(activeInvoice) : undefined,
        search ? or(ilike(orders.number, search), ilike(sql`${orders.customerSnapshot}->>'displayName'`, search), ilike(sql`${orders.customerSnapshot}->>'email'`, search)) : undefined,
      );
      const [{ totalItems = 0 } = {}] = await transaction.select({ totalItems: count() }).from(orders).where(where);
      const direction = query.sortOrder === "asc" ? asc : desc;
      const items = await transaction.select({ ...summaryColumns, customerId: orders.customerId, customerSnapshot: orders.customerSnapshot })
        .from(orders).where(where).orderBy(direction(orders[query.sortBy]), direction(orders.id))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
      return { items, page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  changeStatus(actor: AuthenticatedUser, id: string, status: OrderStatus) {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") throw new ForbiddenException();
    return this.database.client.transaction(async (transaction) => {
      const [order] = await transaction.select(summaryColumns).from(orders).where(eq(orders.id, id)).for("update").limit(1);
      if (!order) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found" });
      try { assertOrderTransition(order.status, status); }
      catch (error) {
        if (error instanceof InvalidOrderTransitionError) throw new ConflictException({ code: error.code, message: error.message });
        throw error;
      }
      if (status !== "COMPLETED") throw new ConflictException({
        code: "ORDER_DEDICATED_WORKFLOW_REQUIRED", message: "Use the invoice or cancellation workflow to change this status",
      });
      const [updated] = await transaction.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id)).returning(summaryColumns);
      await transaction.insert(auditEntries).values({
        actorUserId: actor.id, action: "ORDER_STATUS_CHANGED", entityType: "ORDER", entityId: id,
        changes: { before: { status: order.status }, after: { status } },
      });
      return updated;
    });
  }
}
