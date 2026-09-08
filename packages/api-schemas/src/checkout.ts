import { z } from "zod";

const calculatedMoneySchema = z.string().regex(/^\d+\.\d{2}$/);

export const paymentMethodSchema = z.enum([
  "SIMULATED_CARD_APPROVED",
  "SIMULATED_CARD_REJECTED",
]);
export const shippingMethodSchema = z.enum([
  "PICKUP",
  "STANDARD",
  "EXPRESS",
]);

export const checkoutAddressSchema = z
  .object({
    recipientName: z.string().trim().min(1).max(120),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().min(1).max(200).optional(),
    city: z.string().trim().min(1).max(120),
    region: z.string().trim().min(1).max(120),
    postalCode: z.string().trim().min(1).max(32),
    countryCode: z.string().trim().regex(/^[A-Z]{2}$/),
  })
  .strict();

export const checkoutRequestSchema = z
  .object({
    paymentMethod: paymentMethodSchema,
    shippingMethod: shippingMethodSchema,
    shippingAddress: checkoutAddressSchema,
  })
  .strict();

export const checkoutOrderItemSchema = z.object({
  productId: z.uuid(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  quantity: z.number().int().positive(),
  unitPrice: calculatedMoneySchema,
  taxAmount: calculatedMoneySchema,
  lineTotal: calculatedMoneySchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const checkoutResultSchema = z.object({
  order: z.object({
    id: z.uuid(),
    number: z.string().trim().min(1),
    status: z.literal("PROCESSING"),
    currency: z.string().regex(/^[A-Z]{3}$/),
    subtotal: calculatedMoneySchema,
    shippingTotal: calculatedMoneySchema,
    taxTotal: calculatedMoneySchema,
    total: calculatedMoneySchema,
    items: z.array(checkoutOrderItemSchema).min(1),
    createdAt: z.iso.datetime({ offset: true }),
  }),
  payment: z.object({
    status: z.literal("APPROVED"),
    method: paymentMethodSchema,
    providerReference: z.string().trim().min(1),
  }),
});

export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type ShippingMethod = z.infer<typeof shippingMethodSchema>;
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutOrderItem = z.infer<typeof checkoutOrderItemSchema>;
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;
