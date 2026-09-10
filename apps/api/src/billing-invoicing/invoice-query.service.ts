import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { DatabaseService } from "../database/database.service";
import { invoiceLines, invoices } from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  SYSTEM_CURRENCY,
  type SystemCurrency,
} from "../shared/system-currency";
import type {
  InvoiceLineSnapshot,
  InvoiceOrigin,
  InvoiceSnapshot,
  InvoiceStatus,
} from "./invoice.aggregate";

export type InvoiceQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  customerId?: string;
  status?: InvoiceStatus;
  origin?: InvoiceOrigin;
  createdFrom?: string;
  createdTo?: string;
  sortBy: "createdAt" | "number" | "total" | "status" | "origin";
  sortOrder: "asc" | "desc";
}>;

type StoredInvoice = typeof invoices.$inferSelect;

const sortColumns = {
  createdAt: invoices.createdAt,
  number: invoices.number,
  total: invoices.total,
  status: invoices.status,
  origin: invoices.origin,
} as const;

function restoreCurrency(value: string): SystemCurrency {
  if (value !== SYSTEM_CURRENCY) {
    throw new TypeError("Stored invoice currency must be USD");
  }
  return value;
}

function lineSnapshot(line: typeof invoiceLines.$inferSelect): InvoiceLineSnapshot {
  return {
    productId: line.productId,
    position: line.position,
    skuSnapshot: line.skuSnapshot,
    nameSnapshot: line.nameSnapshot,
    descriptionSnapshot: line.descriptionSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    taxAmount: line.taxAmount,
    lineSubtotal: line.lineSubtotal,
    lineTotal: line.lineTotal,
    currency: restoreCurrency(line.currency),
  };
}

function snapshot(invoice: StoredInvoice, lines: InvoiceLineSnapshot[] = []): InvoiceSnapshot {
  return {
    id: invoice.id,
    number: invoice.number,
    origin: invoice.origin,
    status: invoice.status,
    orderId: invoice.orderId,
    customerId: invoice.customerId,
    createdByUserId: invoice.createdByUserId,
    currency: restoreCurrency(invoice.currency),
    subtotal: invoice.subtotal,
    shippingTotal: invoice.shippingTotal,
    taxTotal: invoice.taxTotal,
    total: invoice.total,
    issuerSnapshot: structuredClone(invoice.issuerSnapshot),
    customerSnapshot: structuredClone(invoice.customerSnapshot),
    lines,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    issuedAt: invoice.issuedAt?.toISOString() ?? null,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    voidedAt: invoice.voidedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class InvoiceQueryService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  list(actor: AuthenticatedUser, query: InvoiceQuery) {
    if (!["ADMIN", "BILLING", "CUSTOMER"].includes(actor.role)) {
      throw new ForbiddenException();
    }

    return this.database.client.transaction(async (transaction) => {
      const search = query.search
        ? `%${query.search.replace(/[\\%_]/g, "\\$&")}%`
        : undefined;
      const where = and(
        actor.role === "CUSTOMER"
          ? eq(invoices.customerId, actor.id)
          : query.customerId
            ? eq(invoices.customerId, query.customerId)
            : undefined,
        query.status ? eq(invoices.status, query.status) : undefined,
        query.origin ? eq(invoices.origin, query.origin) : undefined,
        query.createdFrom
          ? gte(invoices.createdAt, new Date(query.createdFrom))
          : undefined,
        query.createdTo
          ? lte(invoices.createdAt, new Date(query.createdTo))
          : undefined,
        search
          ? or(
              ilike(invoices.number, search),
              ilike(sql`${invoices.customerSnapshot}->>'displayName'`, search),
              ilike(sql`${invoices.customerSnapshot}->>'email'`, search),
            )
          : undefined,
      );
      const [{ totalItems = 0 } = {}] = await transaction
        .select({ totalItems: count() })
        .from(invoices)
        .where(where);
      const direction = query.sortOrder === "asc" ? asc : desc;
      const sortColumn = sortColumns[query.sortBy];
      const items = await transaction
        .select({
          id: invoices.id,
          number: invoices.number,
          origin: invoices.origin,
          status: invoices.status,
          orderId: invoices.orderId,
          customerId: invoices.customerId,
          createdByUserId: invoices.createdByUserId,
          currency: invoices.currency,
          subtotal: invoices.subtotal,
          shippingTotal: invoices.shippingTotal,
          taxTotal: invoices.taxTotal,
          total: invoices.total,
          issuerSnapshot: invoices.issuerSnapshot,
          customerSnapshot: invoices.customerSnapshot,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          issuedAt: invoices.issuedAt,
          dueAt: invoices.dueAt,
          paidAt: invoices.paidAt,
          voidedAt: invoices.voidedAt,
        })
        .from(invoices)
        .where(where)
        .orderBy(direction(sortColumn), direction(invoices.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);

      return {
        items: items.map((item) =>
          Object.fromEntries(
            Object.entries(snapshot(item)).filter(([key]) => key !== "lines"),
          ),
        ),
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  detail(actor: AuthenticatedUser, invoiceId: string): Promise<InvoiceSnapshot> {
    if (!["ADMIN", "BILLING", "CUSTOMER"].includes(actor.role)) {
      throw new ForbiddenException();
    }

    return this.database.client.transaction(async (transaction) => {
      const [invoice] = await transaction
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.id, invoiceId),
            actor.role === "CUSTOMER"
              ? eq(invoices.customerId, actor.id)
              : undefined,
          ),
        )
        .limit(1);
      if (!invoice) {
        throw new NotFoundException({
          code: "INVOICE_NOT_FOUND",
          message: "Invoice not found",
        });
      }
      const lines = await transaction
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, invoiceId))
        .orderBy(asc(invoiceLines.position));
      return snapshot(invoice, lines.map(lineSnapshot));
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }
}
