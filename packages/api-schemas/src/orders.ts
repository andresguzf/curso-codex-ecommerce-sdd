import { z } from "zod";

import { checkoutOrderItemSchema } from "./checkout";
import { systemCurrencySchema } from "./products";

export const orderStatusSchema = z.enum(["PROCESSING", "INVOICED", "COMPLETED", "CANCELLED"]);
const money = z.string().regex(/^\d+\.\d{2}$/);
export const customerOrderSummarySchema = z.object({
  id: z.uuid(), number: z.string().min(1), status: orderStatusSchema, currency: systemCurrencySchema,
  subtotal: money, shippingTotal: money, taxTotal: money, total: money,
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  cancelledAt: z.iso.datetime({ offset: true }).nullable(),
});
export const customerOrderPageSchema = z.object({
  items: z.array(customerOrderSummarySchema), page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100), totalItems: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export const customerOrderDetailSchema = customerOrderSummarySchema.extend({
  customerSnapshot: z.record(z.string(), z.unknown()),
  shippingAddressSnapshot: z.record(z.string(), z.unknown()),
  shippingMethodSnapshot: z.record(z.string(), z.unknown()),
  paymentSnapshot: z.record(z.string(), z.unknown()),
  items: z.array(checkoutOrderItemSchema).min(1),
});
export type CustomerOrderPage = z.infer<typeof customerOrderPageSchema>;
export type CustomerOrderDetail = z.infer<typeof customerOrderDetailSchema>;
export const administrativeOrderPageSchema = customerOrderPageSchema.extend({
  items: z.array(customerOrderSummarySchema.extend({
    customerId: z.uuid(), customerSnapshot: z.record(z.string(), z.unknown()),
  })),
});
export type AdministrativeOrderPage = z.infer<typeof administrativeOrderPageSchema>;
export const cancelOrderRequestSchema = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
export const cancelledOrderSchema = customerOrderSummarySchema.extend({ status: z.literal("CANCELLED"), cancelledAt: z.iso.datetime({ offset: true }) });
export type CancelOrderRequest = z.infer<typeof cancelOrderRequestSchema>;
