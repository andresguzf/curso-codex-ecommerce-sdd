import { Injectable } from "@nestjs/common";

import type { DatabaseTransaction } from "../database/database.service";
import { orderItems, orders } from "../database/schema";
import { OrderAggregate, type OrderCommercialSnapshot } from "./order.aggregate";

@Injectable()
export class OrderService {
  /** Uses the checkout transaction so order, payment, cart and stock commit together. */
  async createInTransaction(
    transaction: DatabaseTransaction,
    input: OrderCommercialSnapshot,
    now: Date,
  ): Promise<OrderAggregate> {
    const aggregate = OrderAggregate.create(input, now);
    const { items, createdAt, updatedAt, cancelledAt, ...order } = aggregate.snapshot;
    await transaction.insert(orders).values({
      ...order,
      createdAt: new Date(createdAt),
      updatedAt: new Date(updatedAt),
      cancelledAt: cancelledAt === null ? null : new Date(cancelledAt),
    });
    await transaction.insert(orderItems).values(items.map((line) => ({
      orderId: order.id,
      productId: line.productId,
      nameSnapshot: line.name,
      skuSnapshot: line.sku,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      currency: line.currency,
      createdAt: new Date(createdAt),
    })));
    return aggregate;
  }
}
