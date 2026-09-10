import { z } from "zod";

import { paginationMetadataSchema } from "./common";
import { systemCurrencySchema } from "./products";

export const invoiceOriginSchema = z.enum(["MANUAL", "ORDER"]);
export const invoiceStatusSchema = z.enum(["DRAFT", "PENDING_PAYMENT", "PAID", "VOID"]);
const moneySchema = z.string().regex(/^\d{1,12}\.\d{2}$/);
const snapshotSchema = z.record(z.string(), z.unknown());

export const invoiceLineSchema = z.object({
  productId: z.uuid().nullable(),
  position: z.number().int().positive(),
  skuSnapshot: z.string().nullable(),
  nameSnapshot: z.string().min(1),
  descriptionSnapshot: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: moneySchema,
  taxRate: z.string().regex(/^\d{1,3}\.\d{4}$/),
  taxAmount: moneySchema,
  lineSubtotal: moneySchema,
  lineTotal: moneySchema,
  currency: systemCurrencySchema,
}).strict();

const invoiceFields = {
  id: z.uuid(),
  number: z.string().nullable(),
  origin: invoiceOriginSchema,
  status: invoiceStatusSchema,
  orderId: z.uuid().nullable(),
  customerId: z.uuid(),
  createdByUserId: z.uuid().nullable(),
  currency: systemCurrencySchema,
  subtotal: moneySchema,
  shippingTotal: moneySchema,
  taxTotal: moneySchema,
  total: moneySchema,
  issuerSnapshot: snapshotSchema,
  customerSnapshot: snapshotSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  issuedAt: z.iso.datetime({ offset: true }).nullable(),
  dueAt: z.iso.datetime({ offset: true }).nullable(),
  paidAt: z.iso.datetime({ offset: true }).nullable(),
  voidedAt: z.iso.datetime({ offset: true }).nullable(),
};

export const invoiceSummarySchema = z.object(invoiceFields).strict();
export const invoiceResponseSchema = invoiceSummarySchema.extend({
  lines: z.array(invoiceLineSchema).min(1),
});
export const invoicePageSchema = paginationMetadataSchema.extend({
  items: z.array(invoiceSummarySchema),
});

export const invoiceStatusRequestSchema = z.object({ status: invoiceStatusSchema }).strict();
export const manualInvoiceLineRequestSchema = z.object({
  productId: z.uuid().nullable().optional(),
  sku: z.string().trim().min(1).max(64).nullable().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(5_000).optional(),
  quantity: z.number().int().min(1).max(1_000_000),
  unitPrice: moneySchema,
  taxRate: z.string().regex(/^\d{1,3}\.\d{4}$/),
}).strict();
export const createManualInvoiceRequestSchema = z.object({
  customerId: z.uuid(),
  shippingTotal: moneySchema.default("0.00"),
  lines: z.array(manualInvoiceLineRequestSchema).min(1).max(100),
}).strict();

export type InvoiceSummary = z.infer<typeof invoiceSummarySchema>;
export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;
export type InvoicePage = z.infer<typeof invoicePageSchema>;
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;
export type InvoiceOrigin = z.infer<typeof invoiceOriginSchema>;
export type InvoiceStatusRequest = z.infer<typeof invoiceStatusRequestSchema>;
export type CreateManualInvoiceRequest = z.infer<typeof createManualInvoiceRequestSchema>;
