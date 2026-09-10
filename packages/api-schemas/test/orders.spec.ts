import { describe, expect, it } from "vitest";
import { administrativeOrderPageSchema, cancelledOrderSchema, cancelOrderRequestSchema, customerOrderDetailSchema, customerOrderPageSchema } from "../src/orders";

const summary = {
  id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", number: "ORD-1", status: "INVOICED", currency: "USD",
  subtotal: "10.00", shippingTotal: "0.00", taxTotal: "0.00", total: "10.00",
  createdAt: "2026-09-09T12:00:00.000Z", updatedAt: "2026-09-09T13:00:00.000Z", cancelledAt: null,
};
describe("customer order contracts", () => {
  it("requires a reason and a cancellation timestamp", () => {
    expect(cancelOrderRequestSchema.parse({ reason: "  Customer request  " })).toEqual({ reason: "Customer request" });
    for (const input of [{}, { reason: " " }, { reason: "x".repeat(501) }, { reason: "Test", actorUserId: summary.id }]) expect(cancelOrderRequestSchema.safeParse(input).success).toBe(false);
    expect(cancelledOrderSchema.safeParse({ ...summary, status: "CANCELLED", cancelledAt: summary.updatedAt }).success).toBe(true);
    expect(cancelledOrderSchema.safeParse({ ...summary, status: "CANCELLED" }).success).toBe(false);
  });
  it("requires customer identity in administrative summaries", () => {
    const page = { items: [{ ...summary, customerId: summary.id, customerSnapshot: { displayName: "Customer" } }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    expect(administrativeOrderPageSchema.safeParse(page).success).toBe(true);
    expect(administrativeOrderPageSchema.safeParse({ ...page, items: [summary] }).success).toBe(false);
  });
  it("accepts paginated historical summaries and empty pages", () => {
    expect(customerOrderPageSchema.safeParse({ items: [summary], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }).success).toBe(true);
    expect(customerOrderPageSchema.safeParse({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }).success).toBe(true);
  });
  it("validates snapshot detail, currency, state and monetary precision", () => {
    const detail = { ...summary, customerSnapshot: { displayName: "Original" }, shippingAddressSnapshot: {}, shippingMethodSnapshot: {}, paymentSnapshot: { status: "APPROVED" }, items: [{ productId: summary.id, sku: "SKU", name: "Original", quantity: 1, unitPrice: "10.00", taxAmount: "0.00", lineTotal: "10.00", currency: "USD" }] };
    expect(customerOrderDetailSchema.safeParse(detail).success).toBe(true);
    for (const invalid of [{ currency: "EUR" }, { status: "UNKNOWN" }, { total: 10 }, { items: [] }, { customerSnapshot: null }]) {
      expect(customerOrderDetailSchema.safeParse({ ...detail, ...invalid }).success).toBe(false);
    }
  });
});
