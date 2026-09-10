import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, ne } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { auditEntries, invoiceLines, invoices, orderItems, orders, payments } from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import { assertOrderTransition, InvalidOrderTransitionError } from "../order-management/order.aggregate";
import { SYSTEM_CURRENCY } from "../shared/system-currency";
import { InvoiceAggregate, type InvoiceLineSnapshot, type InvoiceSnapshot } from "./invoice.aggregate";

function multiplyMoney(unitPrice: string, quantity: number): string {
  const cents = BigInt(unitPrice.replace(".", "")) * BigInt(quantity);
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

function orderLineSnapshot(
  line: typeof orderItems.$inferSelect,
  position: number,
): InvoiceLineSnapshot {
  if (line.currency !== SYSTEM_CURRENCY) {
    throw new TypeError("Stored order line currency must be USD");
  }
  return {
    productId: line.productId,
    position,
    skuSnapshot: line.skuSnapshot,
    nameSnapshot: line.nameSnapshot,
    // Order lines do not yet persist a separate description snapshot. Reusing the
    // immutable historical name avoids consulting mutable catalog data.
    descriptionSnapshot: line.nameSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: "0.0000",
    taxAmount: line.taxAmount,
    lineSubtotal: multiplyMoney(line.unitPrice, line.quantity),
    lineTotal: line.lineTotal,
    currency: SYSTEM_CURRENCY,
  };
}

@Injectable()
export class InvoiceFromOrderService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  convert(actor: AuthenticatedUser, orderId: string): Promise<InvoiceSnapshot> {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Only Admin or Billing can invoice orders",
      });
    }

    return this.database.client.transaction(async (transaction) => {
      // Cancellation uses this same first lock, so invoicing and cancellation
      // cannot both commit for the same order.
      const [order] = await transaction
        .select()
        .from(orders)
        .where(eq(orders.id, orderId))
        .for("update")
        .limit(1);
      if (!order) {
        throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found" });
      }

      const [activeInvoice] = await transaction
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.orderId, orderId), ne(invoices.status, "VOID")))
        .limit(1);
      if (activeInvoice) {
        throw new ConflictException({
          code: "ORDER_ACTIVE_INVOICE",
          message: "The order already has an active invoice",
        });
      }

      try {
        assertOrderTransition(order.status, "INVOICED");
      } catch (error) {
        if (error instanceof InvalidOrderTransitionError) {
          throw new ConflictException({ code: error.code, message: error.message });
        }
        throw error;
      }

      const [storedLines, storedPayments] = await Promise.all([
        transaction
          .select()
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId))
          .orderBy(asc(orderItems.id)),
        transaction.select().from(payments).where(eq(payments.orderId, orderId)).limit(1),
      ]);
      const payment = storedPayments[0];
      if (!payment) {
        throw new ConflictException({
          code: "ORDER_PAYMENT_NOT_FOUND",
          message: "The order has no recorded payment",
        });
      }
      if (order.currency !== SYSTEM_CURRENCY || payment.currency !== SYSTEM_CURRENCY) {
        throw new TypeError("Stored order and payment currency must be USD");
      }

      const now = new Date();
      let invoice = InvoiceAggregate.createDraft(
        {
          origin: "ORDER",
          orderId: order.id,
          customerId: order.customerId,
          createdByUserId: actor.id,
          currency: SYSTEM_CURRENCY,
          subtotal: order.subtotal,
          shippingTotal: order.shippingTotal,
          taxTotal: order.taxTotal,
          total: order.total,
          // The company profile snapshot is added to orders by task 15.4. Until
          // then the conversion preserves the available order-owned snapshots.
          issuerSnapshot: {},
          customerSnapshot: structuredClone(order.customerSnapshot),
          lines: storedLines.map((line, index) => orderLineSnapshot(line, index + 1)),
        },
        now,
      ).transition("PENDING_PAYMENT", now);
      if (payment.status === "APPROVED") invoice = invoice.transition("PAID", now);
      const snapshot = invoice.snapshot;

      await transaction.insert(invoices).values({
        id: snapshot.id,
        number: snapshot.number,
        origin: snapshot.origin,
        status: snapshot.status,
        orderId: snapshot.orderId,
        customerId: snapshot.customerId,
        createdByUserId: snapshot.createdByUserId,
        currency: snapshot.currency,
        subtotal: snapshot.subtotal,
        shippingTotal: snapshot.shippingTotal,
        taxTotal: snapshot.taxTotal,
        total: snapshot.total,
        issuerSnapshot: snapshot.issuerSnapshot,
        customerSnapshot: snapshot.customerSnapshot,
        createdAt: new Date(snapshot.createdAt),
        updatedAt: new Date(snapshot.updatedAt),
        issuedAt: snapshot.issuedAt ? new Date(snapshot.issuedAt) : null,
        dueAt: snapshot.dueAt ? new Date(snapshot.dueAt) : null,
        paidAt: snapshot.paidAt ? new Date(snapshot.paidAt) : null,
        voidedAt: snapshot.voidedAt ? new Date(snapshot.voidedAt) : null,
      });
      await transaction.insert(invoiceLines).values(
        snapshot.lines.map((line) => ({
          ...line,
          invoiceId: snapshot.id,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await transaction
        .update(orders)
        .set({ status: "INVOICED", updatedAt: now })
        .where(eq(orders.id, orderId));
      await transaction.insert(auditEntries).values([
        {
          actorUserId: actor.id,
          action: "INVOICE_CREATED_FROM_ORDER",
          entityType: "INVOICE",
          entityId: snapshot.id,
          changes: {
            before: null,
            after: {
              number: snapshot.number,
              orderId,
              origin: snapshot.origin,
              status: snapshot.status,
            },
          },
        },
        {
          actorUserId: actor.id,
          action: "ORDER_INVOICED",
          entityType: "ORDER",
          entityId: orderId,
          changes: {
            before: { status: order.status },
            after: { status: "INVOICED" },
            invoiceId: snapshot.id,
          },
        },
      ]);

      return snapshot;
    });
  }
}
