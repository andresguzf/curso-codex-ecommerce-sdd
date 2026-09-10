import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { DatabaseService } from "../database/database.service";
import {
  auditEntries,
  invoiceLines,
  invoices,
  products,
  roleAssignments,
  users,
} from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import { SYSTEM_CURRENCY } from "../shared/system-currency";
import {
  InvoiceAggregate,
  type InvoiceLineSnapshot,
  type InvoiceSnapshot,
} from "./invoice.aggregate";

const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/);
const taxRateSchema = z
  .string()
  .regex(/^\d{1,3}\.\d{4}$/)
  .refine((value) => BigInt(value.replace(".", "")) <= 1_000_000n);

const manualInvoiceLineSchema = z
  .object({
    productId: z.uuid().nullable().optional().default(null),
    sku: z.string().trim().min(1).max(64).nullable().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(5_000).optional(),
    quantity: z.number().int().min(1).max(1_000_000),
    unitPrice: moneySchema,
    taxRate: taxRateSchema,
  })
  .strict()
  .superRefine((line, context) => {
    if (line.productId === null && !line.name) {
      context.addIssue({
        code: "custom",
        message: "A custom line requires a name",
        path: ["name"],
      });
    }
    if (line.productId === null && !line.description) {
      context.addIssue({
        code: "custom",
        message: "A custom line requires a description",
        path: ["description"],
      });
    }
  });

export const manualInvoiceRequestSchema = z
  .object({
    customerId: z.uuid(),
    shippingTotal: moneySchema.default("0.00"),
    lines: z.array(manualInvoiceLineSchema).min(1).max(100),
  })
  .strict();

export type ManualInvoiceRequest = z.infer<typeof manualInvoiceRequestSchema>;

function cents(value: string): bigint {
  return BigInt(value.replace(".", ""));
}

function money(value: bigint): string {
  return `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
}

function taxFor(lineSubtotal: bigint, taxRate: string): bigint {
  const rateUnits = BigInt(taxRate.replace(".", ""));
  return (lineSubtotal * rateUnits + 500_000n) / 1_000_000n;
}

@Injectable()
export class ManualInvoiceService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  create(
    actor: AuthenticatedUser,
    request: ManualInvoiceRequest,
  ): Promise<InvoiceSnapshot> {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") {
      throw new ForbiddenException({
        code: "AUTH_FORBIDDEN",
        message: "Only Admin or Billing can create manual invoices",
      });
    }

    return this.database.client.transaction(async (transaction) => {
      const [customer] = await transaction
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
        })
        .from(users)
        .innerJoin(roleAssignments, eq(roleAssignments.userId, users.id))
        .where(
          and(
            eq(users.id, request.customerId),
            eq(users.status, "ACTIVE"),
            isNull(users.deletedAt),
            eq(roleAssignments.role, "CUSTOMER"),
          ),
        )
        .limit(1);
      if (!customer) {
        throw new NotFoundException({
          code: "INVOICE_CUSTOMER_NOT_FOUND",
          message: "Active customer not found",
        });
      }

      const productIds = [
        ...new Set(
          request.lines.flatMap((line) =>
            line.productId === null ? [] : [line.productId],
          ),
        ),
      ];
      const referencedProducts =
        productIds.length === 0
          ? []
          : await transaction
              .select({
                id: products.id,
                sku: products.sku,
                name: products.name,
                description: products.description,
              })
              .from(products)
              .where(
                and(
                  inArray(products.id, productIds),
                  eq(products.status, "ACTIVE"),
                  isNull(products.deletedAt),
                ),
              );
      const productsById = new Map(
        referencedProducts.map((product) => [product.id, product]),
      );
      const missingProductId = productIds.find(
        (productId) => !productsById.has(productId),
      );
      if (missingProductId) {
        throw new NotFoundException({
          code: "INVOICE_PRODUCT_NOT_FOUND",
          message: "Active product not found",
          details: { productId: missingProductId },
        });
      }

      let subtotalCents = 0n;
      let taxTotalCents = 0n;
      const lines: InvoiceLineSnapshot[] = request.lines.map((line, index) => {
        const product = line.productId ? productsById.get(line.productId) : undefined;
        const lineSubtotalCents = cents(line.unitPrice) * BigInt(line.quantity);
        const taxAmountCents = taxFor(lineSubtotalCents, line.taxRate);
        subtotalCents += lineSubtotalCents;
        taxTotalCents += taxAmountCents;
        return {
          productId: line.productId,
          position: index + 1,
          skuSnapshot: product?.sku ?? line.sku ?? null,
          nameSnapshot: product?.name ?? line.name!,
          descriptionSnapshot: product?.description ?? line.description!,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          taxAmount: money(taxAmountCents),
          lineSubtotal: money(lineSubtotalCents),
          lineTotal: money(lineSubtotalCents + taxAmountCents),
          currency: SYSTEM_CURRENCY,
        };
      });
      const shippingCents = cents(request.shippingTotal);
      const now = new Date();
      let snapshot: InvoiceSnapshot;
      try {
        snapshot = InvoiceAggregate.createDraft(
          {
            origin: "MANUAL",
            orderId: null,
            customerId: customer.id,
            createdByUserId: actor.id,
            currency: SYSTEM_CURRENCY,
            subtotal: money(subtotalCents),
            shippingTotal: money(shippingCents),
            taxTotal: money(taxTotalCents),
            total: money(subtotalCents + shippingCents + taxTotalCents),
            // StoreProfile and the real issuer snapshot are introduced by 15.1-15.4.
            issuerSnapshot: {},
            customerSnapshot: {
              id: customer.id,
              displayName: customer.displayName,
              email: customer.email,
            },
            lines,
          },
          now,
        ).snapshot;
      } catch (error) {
        if (error instanceof TypeError) {
          throw new BadRequestException({
            code: "REQUEST_VALIDATION_FAILED",
            message: "Invalid manual invoice totals",
          });
        }
        throw error;
      }

      await transaction.insert(invoices).values({
        id: snapshot.id,
        number: snapshot.number,
        origin: snapshot.origin,
        status: snapshot.status,
        orderId: null,
        customerId: snapshot.customerId,
        createdByUserId: snapshot.createdByUserId,
        currency: snapshot.currency,
        subtotal: snapshot.subtotal,
        shippingTotal: snapshot.shippingTotal,
        taxTotal: snapshot.taxTotal,
        total: snapshot.total,
        issuerSnapshot: snapshot.issuerSnapshot,
        customerSnapshot: snapshot.customerSnapshot,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(invoiceLines).values(
        snapshot.lines.map((line) => ({
          ...line,
          invoiceId: snapshot.id,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await transaction.insert(auditEntries).values({
        actorUserId: actor.id,
        action: "MANUAL_INVOICE_CREATED",
        entityType: "INVOICE",
        entityId: snapshot.id,
        changes: {
          before: null,
          after: {
            customerId: customer.id,
            lineCount: snapshot.lines.length,
            orderId: null,
            origin: "MANUAL",
            status: "DRAFT",
            total: snapshot.total,
          },
        },
      });

      return snapshot;
    });
  }
}
