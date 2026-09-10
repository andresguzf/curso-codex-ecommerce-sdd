import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { DatabaseService } from "../database/database.service";
import { auditEntries, invoices, orders } from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import { InventoryStockService } from "../inventory-control/inventory-stock.service";
import { InventoryStockOverflowError } from "../inventory-control/inventory-stock.repository";
import { summaryColumns } from "./customer-orders.service";
import { assertOrderTransition, InvalidOrderTransitionError } from "./order.aggregate";

export const cancellationRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();

@Injectable()
export class OrderCancellationService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(InventoryStockService) private readonly inventory: InventoryStockService,
  ) {}

  cancel(actor: AuthenticatedUser, orderId: string, body: unknown) {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") throw new ForbiddenException({
      code: "AUTH_FORBIDDEN", message: "Only Admin or Billing can cancel orders",
    });
    const parsed = cancellationRequestSchema.safeParse(body);
    if (!z.uuid().safeParse(orderId).success || !parsed.success) throw new BadRequestException({
      code: "REQUEST_VALIDATION_FAILED", message: "A valid order identifier and cancellation reason are required",
    });
    return this.database.client.transaction(async (transaction) => {
      // Completion and future invoice creation coordinate on this same lock.
      const [order] = await transaction.select(summaryColumns).from(orders)
        .where(eq(orders.id, orderId)).for("update").limit(1);
      if (!order) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found" });
      if (order.status === "CANCELLED") return order;
      try { assertOrderTransition(order.status, "CANCELLED"); }
      catch (error) {
        if (error instanceof InvalidOrderTransitionError) throw new ConflictException({ code: error.code, message: error.message });
        throw error;
      }
      const [activeInvoice] = await transaction.select({ id: invoices.id }).from(invoices)
        .where(and(eq(invoices.orderId, orderId), ne(invoices.status, "VOID"))).limit(1);
      if (activeInvoice) throw new ConflictException({
        code: "ORDER_ACTIVE_INVOICE", message: "Void the active invoice before cancelling this order",
      });
      let movements;
      try {
        movements = await this.inventory.restoreOrderInTransaction(transaction, {
          actorUserId: actor.id, reason: parsed.data.reason, referenceId: orderId, referenceType: "ORDER",
        });
      } catch (error) {
        if (error instanceof InventoryStockOverflowError) throw new ConflictException({
          code: "ORDER_RESTOCK_OVERFLOW", message: "The restored stock would exceed the supported quantity",
        });
        throw error;
      }
      const now = new Date();
      const [cancelled] = await transaction.update(orders).set({ status: "CANCELLED", cancelledAt: now, updatedAt: now })
        .where(eq(orders.id, orderId)).returning(summaryColumns);
      if (!cancelled) throw new Error("PostgreSQL did not return the cancelled order");
      await transaction.insert(auditEntries).values({
        actorUserId: actor.id, entityType: "ORDER", entityId: orderId, action: "ORDER_CANCELLED",
        changes: { before: { status: order.status }, after: { status: "CANCELLED" }, reason: parsed.data.reason, movementIds: movements.map((movement) => movement.movementId) },
      });
      return cancelled;
    });
  }
}
