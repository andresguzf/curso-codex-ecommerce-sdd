import { randomUUID } from "node:crypto";

import { SYSTEM_CURRENCY } from "../shared/system-currency";

export const ORDER_STATUSES = ["PROCESSING", "INVOICED", "COMPLETED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
type SnapshotObject = Readonly<Record<string, unknown>>;

export type OrderLineSnapshot = Readonly<{
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string;
  taxAmount: string;
  lineTotal: string;
  currency: typeof SYSTEM_CURRENCY;
}>;

export type OrderCommercialSnapshot = Readonly<{
  customerId: string;
  customerSnapshot: Readonly<{ id: string; displayName: string; email: string }>;
  shippingAddressSnapshot: SnapshotObject;
  shippingMethodSnapshot: SnapshotObject;
  paymentSnapshot: SnapshotObject;
  currency: typeof SYSTEM_CURRENCY;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  total: string;
  items: readonly OrderLineSnapshot[];
}>;

export type OrderSnapshot = OrderCommercialSnapshot & Readonly<{
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
}>;

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PROCESSING: ["INVOICED", "CANCELLED"],
  INVOICED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export class InvalidOrderTransitionError extends Error {
  readonly code = "ORDER_INVALID_TRANSITION";

  constructor(readonly from: OrderStatus, readonly to: OrderStatus) {
    super(`Order cannot transition from ${from} to ${to}`);
    this.name = "InvalidOrderTransitionError";
  }
}

function cents(value: string): bigint {
  if (!/^\d{1,12}\.\d{2}$/.test(value)) {
    throw new TypeError("Order amounts must be nonnegative fixed-precision decimals");
  }
  return BigInt(value.replace(".", ""));
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!TRANSITIONS[from].includes(to)) throw new InvalidOrderTransitionError(from, to);
}

function validate(snapshot: OrderSnapshot): void {
  if (!snapshot.id.trim() || !snapshot.number.trim() || snapshot.number.length > 64) {
    throw new TypeError("Order identity and number are required");
  }
  if (!ORDER_STATUSES.includes(snapshot.status)) throw new TypeError("Invalid order status");
  if (snapshot.customerId !== snapshot.customerSnapshot.id || !snapshot.customerId.trim()) {
    throw new TypeError("Order customer snapshot must identify its owner");
  }
  if (snapshot.currency !== SYSTEM_CURRENCY || snapshot.items.length === 0) {
    throw new TypeError("An order requires USD and at least one line");
  }
  let subtotal = 0n;
  let taxTotal = 0n;
  const productIds = new Set<string>();
  for (const line of snapshot.items) {
    if (!line.productId.trim() || !line.sku.trim() || !line.name.trim()
      || productIds.has(line.productId) || line.currency !== SYSTEM_CURRENCY
      || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 2_147_483_647) {
      throw new TypeError("Invalid or duplicate order line");
    }
    productIds.add(line.productId);
    const net = cents(line.unitPrice) * BigInt(line.quantity);
    const tax = cents(line.taxAmount);
    if (cents(line.lineTotal) !== net + tax) throw new TypeError("Inconsistent order line total");
    subtotal += net;
    taxTotal += tax;
  }
  if (cents(snapshot.subtotal) !== subtotal || cents(snapshot.taxTotal) !== taxTotal
    || cents(snapshot.total) !== subtotal + taxTotal + cents(snapshot.shippingTotal)) {
    throw new TypeError("Inconsistent order totals");
  }
  if (!Number.isFinite(Date.parse(snapshot.createdAt)) || !Number.isFinite(Date.parse(snapshot.updatedAt))
    || Date.parse(snapshot.updatedAt) < Date.parse(snapshot.createdAt)
    || (snapshot.status === "CANCELLED") !== (snapshot.cancelledAt !== null)
    || (snapshot.cancelledAt !== null && (!Number.isFinite(Date.parse(snapshot.cancelledAt))
      || Date.parse(snapshot.cancelledAt) < Date.parse(snapshot.createdAt)))) {
    throw new TypeError("Invalid order lifecycle dates");
  }
}

/** Historical data is copied on input/output; transitions return a new aggregate. */
export class OrderAggregate {
  readonly #snapshot: OrderSnapshot;

  private constructor(snapshot: OrderSnapshot) {
    validate(snapshot);
    this.#snapshot = structuredClone(snapshot);
  }

  static create(input: OrderCommercialSnapshot, now = new Date()): OrderAggregate {
    if (input.paymentSnapshot.status !== "APPROVED") {
      throw new TypeError("A confirmed order requires an approved checkout payment");
    }
    const id = randomUUID();
    return new OrderAggregate({
      ...input,
      id,
      number: `ORD-${id.toUpperCase()}`,
      status: "PROCESSING",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      cancelledAt: null,
    });
  }

  static restore(snapshot: OrderSnapshot): OrderAggregate {
    return new OrderAggregate(snapshot);
  }

  get snapshot(): OrderSnapshot {
    return structuredClone(this.#snapshot);
  }

  /** Domain rules only. Callers must authorize and coordinate invoice/stock atomically. */
  transition(to: OrderStatus, now = new Date()): OrderAggregate {
    const from = this.#snapshot.status;
    assertOrderTransition(from, to);
    if (now.getTime() < Date.parse(this.#snapshot.updatedAt)) {
      throw new TypeError("Order transition cannot precede its last update");
    }
    return new OrderAggregate({
      ...this.#snapshot,
      status: to,
      updatedAt: now.toISOString(),
      cancelledAt: to === "CANCELLED" ? now.toISOString() : null,
    });
  }
}
