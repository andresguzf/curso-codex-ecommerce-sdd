import { describe, expect, it } from "vitest";

import {
  InvalidOrderTransitionError,
  ORDER_STATUSES,
  OrderAggregate,
  type OrderCommercialSnapshot,
  type OrderStatus,
} from "./order.aggregate";

const now = new Date("2026-09-09T12:00:00.000Z");
const later = new Date("2026-09-09T13:00:00.000Z");

function fixture() {
  return {
    customerId: "customer-1",
    customerSnapshot: { id: "customer-1", displayName: "Original customer", email: "customer@example.com" },
    shippingAddressSnapshot: { line1: "Original address", nested: { city: "Santiago" } },
    shippingMethodSnapshot: { method: "STANDARD", cost: "5.00" },
    paymentSnapshot: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED" },
    currency: "USD" as const,
    subtotal: "20.20",
    taxTotal: "0.80",
    shippingTotal: "5.00",
    total: "26.00",
    items: [{
      productId: "product-1", sku: "SKU-1", name: "Original product", quantity: 2,
      unitPrice: "10.10", taxAmount: "0.80", lineTotal: "21.00", currency: "USD" as const,
    }],
  } satisfies OrderCommercialSnapshot;
}

describe("OrderAggregate", () => {
  it("creates a PROCESSING order with a unique stable number and USD snapshots", () => {
    const order = OrderAggregate.create(fixture(), now).snapshot;
    const another = OrderAggregate.create(fixture(), now).snapshot;
    expect(order).toMatchObject({ ...fixture(), status: "PROCESSING", createdAt: now.toISOString(), cancelledAt: null });
    expect(order.number).toBe(`ORD-${order.id.toUpperCase()}`);
    expect(another.number).not.toBe(order.number);
    expect(OrderAggregate.restore(order).snapshot).toEqual(order);
  });

  it("does not retain mutable references to inputs, nested snapshots or returned data", () => {
    const input = fixture();
    const aggregate = OrderAggregate.create(input, now);
    const original = aggregate.snapshot;
    input.customerSnapshot.displayName = "Changed customer";
    input.items[0]!.name = "Changed product";
    input.shippingAddressSnapshot.nested.city = "Changed city";
    input.paymentSnapshot.status = "REJECTED";
    const exposed = aggregate.snapshot;
    (exposed.shippingAddressSnapshot.nested as { city: string }).city = "External mutation";
    (exposed.items[0] as { name: string }).name = "External product";
    expect(aggregate.snapshot).toEqual(original);
    const restored = OrderAggregate.restore(original);
    (original.customerSnapshot as { displayName: string }).displayName = "Changed persisted input";
    expect(restored.snapshot.customerSnapshot.displayName).toBe("Original customer");
  });

  const allowed = new Set(["PROCESSING:INVOICED", "PROCESSING:CANCELLED", "INVOICED:COMPLETED", "INVOICED:CANCELLED"]);
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      it(`checks transition ${from} -> ${to} without changing historical data`, () => {
        const initial = OrderAggregate.create(fixture(), now).snapshot;
        const order = OrderAggregate.restore({
          ...initial, status: from, cancelledAt: from === "CANCELLED" ? now.toISOString() : null,
        });
        const before = order.snapshot;
        if (allowed.has(`${from}:${to}`)) {
          expect(order.transition(to, later).snapshot).toEqual({
            ...before, status: to, updatedAt: later.toISOString(),
            cancelledAt: to === "CANCELLED" ? later.toISOString() : null,
          });
        } else {
          expect(() => order.transition(to, later)).toThrow(InvalidOrderTransitionError);
        }
        expect(order.snapshot).toEqual(before);
      });
    }
  }

  it("rejects an unknown target state and dates before the last update", () => {
    const order = OrderAggregate.create(fixture(), now);
    expect(() => order.transition("UNKNOWN" as OrderStatus)).toThrow(InvalidOrderTransitionError);
    expect(() => order.transition("INVOICED", new Date("2020-01-01"))).toThrow(TypeError);
    expect(() => order.transition("INVOICED", later).transition("COMPLETED", now)).toThrow(TypeError);
  });

  it("rejects rejected payments, empty or duplicate lines, invalid quantities and inconsistent money", () => {
    const input = fixture();
    const invalid: OrderCommercialSnapshot[] = [
      { ...input, paymentSnapshot: { status: "REJECTED" } },
      { ...input, customerId: "other-customer" },
      { ...input, items: [] },
      { ...input, items: [...input.items, ...input.items] },
      { ...input, currency: "EUR" as "USD" },
      { ...input, total: "26.001" },
      { ...input, total: "25.00" },
      { ...input, subtotal: "20.00" },
      { ...input, shippingTotal: "-5.00" },
      { ...input, taxTotal: "0.00" },
      ...[0, -1, 1.5, 2_147_483_648].map((quantity) => ({ ...input, items: [{ ...input.items[0]!, quantity }] })),
      { ...input, items: [{ ...input.items[0]!, lineTotal: "20.20" }] },
    ];
    for (const value of invalid) expect(() => OrderAggregate.create(value, now)).toThrow();
  });
});
