import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, count, desc, eq } from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { orderItems, orders } from "../database/schema";
import type { OrderStatus } from "./order.aggregate";
import type { AuthenticatedUser } from "../identity-access/auth.types";

export type CustomerOrderQuery = Readonly<{ page: number; pageSize: number; status?: OrderStatus }>;

export const summaryColumns = {
  id: orders.id, number: orders.number, status: orders.status,
  currency: orders.currency, subtotal: orders.subtotal, shippingTotal: orders.shippingTotal,
  taxTotal: orders.taxTotal, total: orders.total, createdAt: orders.createdAt,
  updatedAt: orders.updatedAt, cancelledAt: orders.cancelledAt,
};

@Injectable()
export class CustomerOrdersService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(customerId: string, query: CustomerOrderQuery) {
    return this.database.client.transaction(async (transaction) => {
      const where = and(eq(orders.customerId, customerId),
        query.status ? eq(orders.status, query.status) : undefined);
      const [{ totalItems = 0 } = {}] = await transaction.select({ totalItems: count() }).from(orders).where(where);
      const items = await transaction.select(summaryColumns).from(orders).where(where)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
      return {
        items, page: query.page, pageSize: query.pageSize, totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  detail(actor: AuthenticatedUser, orderId: string) {
    return this.database.client.transaction(async (transaction) => {
      const [order] = await transaction.select({
        ...summaryColumns,
        customerSnapshot: orders.customerSnapshot,
        shippingAddressSnapshot: orders.shippingAddressSnapshot,
        shippingMethodSnapshot: orders.shippingMethodSnapshot,
        paymentSnapshot: orders.paymentSnapshot,
      }).from(orders).where(and(eq(orders.id, orderId), actor.role === "CUSTOMER" ? eq(orders.customerId, actor.id) : undefined)).limit(1);
      // Missing and foreign orders are indistinguishable to the caller.
      if (!order) throw new NotFoundException({ code: "ORDER_NOT_FOUND", message: "Order not found" });
      const items = await transaction.select({
        productId: orderItems.productId, sku: orderItems.skuSnapshot, name: orderItems.nameSnapshot,
        quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, taxAmount: orderItems.taxAmount,
        lineTotal: orderItems.lineTotal, currency: orderItems.currency,
      }).from(orderItems).where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.createdAt), asc(orderItems.productId));
      return { ...order, items };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
