import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { asc, eq } from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry";
import { DatabaseService } from "../database/database.service";
import {
  auditEntries,
  invoiceLines,
  invoices,
} from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  SYSTEM_CURRENCY,
  type SystemCurrency,
} from "../shared/system-currency";
import {
  InvoiceAggregate,
  InvalidInvoiceTransitionError,
  type InvoiceSnapshot,
  type InvoiceStatus,
} from "./invoice.aggregate";

function restoreCurrency(value: string): SystemCurrency {
  if (value !== SYSTEM_CURRENCY) {
    throw new TypeError("Stored invoice currency must be USD");
  }
  return value;
}

@Injectable()
export class InvoiceLifecycleService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async transition(
    actor: AuthenticatedUser,
    invoiceId: string,
    status: InvoiceStatus,
    now = new Date(),
  ): Promise<InvoiceSnapshot> {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") {
      throw new ForbiddenException();
    }

    return this.database.client.transaction(async (transaction) => {
      const [stored] = await transaction
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .for("update")
        .limit(1);
      if (!stored) {
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
      const aggregate = InvoiceAggregate.restore({
        ...stored,
        currency: restoreCurrency(stored.currency),
        createdAt: stored.createdAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
        issuedAt: stored.issuedAt?.toISOString() ?? null,
        dueAt: stored.dueAt?.toISOString() ?? null,
        paidAt: stored.paidAt?.toISOString() ?? null,
        voidedAt: stored.voidedAt?.toISOString() ?? null,
        lines: lines.map((line) => ({
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
        })),
      });

      let transitioned: InvoiceAggregate;
      try {
        transitioned = aggregate.transition(status, now);
      } catch (error) {
        if (error instanceof InvalidInvoiceTransitionError) {
          throw new ConflictException({
            code: error.code,
            message: error.message,
          });
        }
        throw error;
      }
      const next = transitioned.snapshot;

      await transaction
        .update(invoices)
        .set({
          number: next.number,
          status: next.status,
          updatedAt: new Date(next.updatedAt),
          issuedAt: next.issuedAt ? new Date(next.issuedAt) : null,
          dueAt: next.dueAt ? new Date(next.dueAt) : null,
          paidAt: next.paidAt ? new Date(next.paidAt) : null,
          voidedAt: next.voidedAt ? new Date(next.voidedAt) : null,
        })
        .where(eq(invoices.id, invoiceId));
      await transaction.insert(auditEntries).values(
        createAuditEntry({
          actorUserId: actor.id,
          action: "INVOICE_STATUS_CHANGED",
          entityType: "INVOICE",
          entityId: invoiceId,
          changes: {
            before: {
              status: aggregate.snapshot.status,
              number: aggregate.snapshot.number,
            },
            after: { status: next.status, number: next.number },
          },
        }),
      );

      return next;
    });
  }
}
