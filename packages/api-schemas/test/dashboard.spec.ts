import { describe, expect, it } from "vitest";
import { dashboardSummarySchema } from "../src/index";

const updatedAt = "2026-09-30T12:00:00.000Z";
const admin = {
  role: "ADMIN", updatedAt, lowStockThreshold: 5,
  metrics: { totalCustomers: 1, activeProducts: 2, lowStockProducts: 1, processingOrders: 0, pendingInvoices: 0 },
};
const billing = {
  role: "BILLING", updatedAt,
  period: { from: "2026-08-31T12:00:00.000Z", to: updatedAt, basis: "paidAt" },
  metrics: { ordersEligibleForInvoicing: 0, ordersAwaitingInvoice: 0, pendingInvoices: 0, paidInvoices: 0 },
};

describe("dashboard response validation", () => {
  it.each([admin, billing])("accepts the complete authorized response for $role", (response) => {
    expect(dashboardSummarySchema.parse(response)).toEqual(response);
  });
  it("rejects CUSTOMER and administrative fields in a billing response", () => {
    expect(dashboardSummarySchema.safeParse({ ...billing, role: "CUSTOMER" }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...billing, lowStockThreshold: 5 }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...billing, metrics: admin.metrics }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...billing, metrics: { ...billing.metrics, activeProducts: 1 } }).success).toBe(false);
  });
  it.each([-1, 1.5, "2", NaN])("rejects invalid counts: %s", (count) => {
    expect(dashboardSummarySchema.safeParse({ ...admin, metrics: { ...admin.metrics, activeProducts: count } }).success).toBe(false);
  });
  it("rejects missing counts, invalid timestamps and reversed periods", () => {
    expect(dashboardSummarySchema.safeParse({ ...admin, metrics: {} }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...admin, updatedAt: "today" }).success).toBe(false);
    expect(dashboardSummarySchema.safeParse({ ...billing, period: { ...billing.period, from: "2026-10-01T12:00:00.000Z" } }).success).toBe(false);
  });
});
