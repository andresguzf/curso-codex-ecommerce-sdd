import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database/database.service";
import { invoices } from "../database/schema";

@Injectable()
export class BillingSummaryReader {
  async read(transaction: DatabaseTransaction, from: Date, to: Date) {
    const [result] = await transaction.select({
      pendingInvoices: sql<number>`count(*) filter (where ${invoices.status} = 'PENDING_PAYMENT')`.mapWith(Number),
      paidInvoices: sql<number>`count(*) filter (where ${invoices.status} = 'PAID'
        and ${invoices.paidAt} >= ${from} and ${invoices.paidAt} <= ${to})`.mapWith(Number),
    }).from(invoices);
    return result ?? { pendingInvoices: 0, paidInvoices: 0 };
  }
}
