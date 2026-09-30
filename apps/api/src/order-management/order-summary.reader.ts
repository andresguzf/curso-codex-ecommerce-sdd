import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database/database.service";
import { invoices, orders, payments } from "../database/schema";

@Injectable()
export class OrderSummaryReader {
  async read(transaction: DatabaseTransaction) {
    // EXISTS avoids duplicate counts; VOID invoices never prevent re-invoicing.
    const awaitingInvoice = sql`${orders.status} = 'PROCESSING' and not exists (
      select 1 from ${invoices} where ${invoices.orderId} = ${orders.id} and ${invoices.status} <> 'VOID')`;
    // Nest the correlated predicate so Drizzle preserves qualified column names
    // inside the subquery rather than resolving id against payments itself.
    const recordedPayment = sql`exists (select 1 from ${payments} where ${payments.orderId} = ${orders.id})`;
    const [result] = await transaction.select({
      processingOrders: sql<number>`count(*) filter (where ${orders.status} = 'PROCESSING')`.mapWith(Number),
      ordersAwaitingInvoice: sql<number>`count(*) filter (where ${awaitingInvoice})`.mapWith(Number),
      ordersEligibleForInvoicing: sql<number>`count(*) filter (where ${awaitingInvoice} and ${recordedPayment})`.mapWith(Number),
    }).from(orders);
    return result ?? { processingOrders: 0, ordersAwaitingInvoice: 0, ordersEligibleForInvoicing: 0 };
  }
}
