import { describe, expect, it } from "vitest";

import {
  InvoiceAggregate,
  InvalidInvoiceTransitionError,
  invoiceNumberFor,
  type InvoiceCommercialSnapshot,
} from "./invoice.aggregate";

const createdAt = new Date("2026-09-10T12:00:00.000Z");
const issuedAt = new Date("2026-09-10T13:00:00.000Z");
const paidAt = new Date("2026-09-10T14:00:00.000Z");
const voidedAt = new Date("2026-09-10T15:00:00.000Z");

function fixture() {
  return {
    origin: "MANUAL",
    orderId: null,
    customerId: "customer-1",
    createdByUserId: "billing-1",
    currency: "USD",
    subtotal: "40.00",
    shippingTotal: "5.00",
    taxTotal: "7.60",
    total: "52.60",
    issuerSnapshot: {
      legalName: "Original Technology Store SpA",
      address: { city: "Santiago" },
    },
    customerSnapshot: {
      displayName: "Original customer",
      email: "customer@example.com",
    },
    lines: [
      {
        productId: "product-1",
        position: 1,
        skuSnapshot: "TECH-001",
        nameSnapshot: "Original product",
        descriptionSnapshot: "Original description",
        quantity: 2,
        unitPrice: "20.00",
        taxRate: "19.0000",
        taxAmount: "7.60",
        lineSubtotal: "40.00",
        lineTotal: "47.60",
        currency: "USD",
      },
    ],
  } satisfies InvoiceCommercialSnapshot;
}

describe("InvoiceAggregate", () => {
  it("creates unnumbered drafts and assigns a stable unique number on issue", () => {
    const draft = InvoiceAggregate.createDraft(fixture(), createdAt);
    const another = InvoiceAggregate.createDraft(fixture(), createdAt);

    expect(draft.snapshot).toMatchObject({
      ...fixture(),
      number: null,
      status: "DRAFT",
      createdAt: createdAt.toISOString(),
      issuedAt: null,
      paidAt: null,
      voidedAt: null,
    });

    const pending = draft.transition("PENDING_PAYMENT", issuedAt).snapshot;
    const anotherPending = another.transition(
      "PENDING_PAYMENT",
      issuedAt,
    ).snapshot;
    expect(pending).toMatchObject({
      status: "PENDING_PAYMENT",
      number: invoiceNumberFor(pending.id),
      issuedAt: issuedAt.toISOString(),
    });
    expect(anotherPending.number).not.toBe(pending.number);
  });

  it("pays and voids through valid transitions without changing snapshots", () => {
    const draft = InvoiceAggregate.createDraft(fixture(), createdAt);
    const pending = draft.transition("PENDING_PAYMENT", issuedAt);
    const paid = pending.transition("PAID", paidAt);
    const voided = paid.transition("VOID", voidedAt);

    expect(paid.snapshot).toMatchObject({
      status: "PAID",
      paidAt: paidAt.toISOString(),
      voidedAt: null,
    });
    expect(voided.snapshot).toMatchObject({
      status: "VOID",
      paidAt: paidAt.toISOString(),
      voidedAt: voidedAt.toISOString(),
    });
    expect(voided.snapshot.lines).toEqual(draft.snapshot.lines);
    expect(voided.snapshot.issuerSnapshot).toEqual(
      draft.snapshot.issuerSnapshot,
    );
    expect(voided.snapshot.customerSnapshot).toEqual(
      draft.snapshot.customerSnapshot,
    );
  });

  it("allows voiding a draft without assigning an issue number", () => {
    const voided = InvoiceAggregate.createDraft(fixture(), createdAt)
      .transition("VOID", issuedAt)
      .snapshot;
    expect(voided).toMatchObject({
      status: "VOID",
      number: null,
      issuedAt: null,
      voidedAt: issuedAt.toISOString(),
    });
  });

  it("preserves an order origin only when it has an order reference", () => {
    const orderInvoice = InvoiceAggregate.createDraft(
      { ...fixture(), origin: "ORDER", orderId: "order-1" },
      createdAt,
    ).snapshot;
    expect(orderInvoice).toMatchObject({
      origin: "ORDER",
      orderId: "order-1",
    });
  });

  it("rejects invalid transitions and dates before the latest change", () => {
    const draft = InvoiceAggregate.createDraft(fixture(), createdAt);
    expect(() => draft.transition("PAID", issuedAt)).toThrow(
      InvalidInvoiceTransitionError,
    );
    const pending = draft.transition("PENDING_PAYMENT", issuedAt);
    expect(() => pending.transition("DRAFT", paidAt)).toThrow(
      InvalidInvoiceTransitionError,
    );
    expect(() => pending.transition("PAID", createdAt)).toThrow(TypeError);
    const voided = pending.transition("VOID", voidedAt);
    expect(() => voided.transition("PAID", voidedAt)).toThrow(
      InvalidInvoiceTransitionError,
    );
  });

  it("does not retain mutable references at creation, restore or output", () => {
    const input = fixture();
    const aggregate = InvoiceAggregate.createDraft(input, createdAt);
    const expected = aggregate.snapshot;
    input.lines[0]!.nameSnapshot = "Changed product";
    input.issuerSnapshot.address.city = "Changed city";
    const exposed = aggregate.snapshot;
    (exposed.customerSnapshot as { displayName: string }).displayName =
      "External customer";
    (exposed.lines[0] as { nameSnapshot: string }).nameSnapshot =
      "External product";
    expect(aggregate.snapshot).toEqual(expected);

    const restored = InvoiceAggregate.restore(expected);
    (expected.issuerSnapshot as { legalName: string }).legalName =
      "Changed persisted input";
    expect(restored.snapshot.issuerSnapshot).toMatchObject({
      legalName: "Original Technology Store SpA",
    });
  });

  it("rejects inconsistent origins, money, lines, currency and lifecycle data", () => {
    const input = fixture();
    const invalid: InvoiceCommercialSnapshot[] = [
      { ...input, origin: "MANUAL", orderId: "order-1" },
      { ...input, origin: "ORDER", orderId: null },
      { ...input, currency: "EUR" as "USD" },
      { ...input, lines: [] },
      { ...input, subtotal: "39.00" },
      { ...input, taxTotal: "7.00" },
      { ...input, total: "52.00" },
      { ...input, shippingTotal: "-1.00" },
      {
        ...input,
        lines: [...input.lines, { ...input.lines[0]! }],
      },
      {
        ...input,
        lines: [{ ...input.lines[0]!, quantity: 0 }],
      },
      {
        ...input,
        lines: [{ ...input.lines[0]!, taxRate: "100.0001" }],
      },
      {
        ...input,
        lines: [{ ...input.lines[0]!, lineTotal: "40.00" }],
      },
    ];
    for (const value of invalid) {
      expect(() => InvoiceAggregate.createDraft(value, createdAt)).toThrow();
    }
  });
});
