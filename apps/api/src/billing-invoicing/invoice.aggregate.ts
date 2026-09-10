import { randomUUID } from "node:crypto";

import { SYSTEM_CURRENCY } from "../shared/system-currency";

export const INVOICE_ORIGINS = ["MANUAL", "ORDER"] as const;
export type InvoiceOrigin = (typeof INVOICE_ORIGINS)[number];

export const INVOICE_STATUSES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "VOID",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

type SnapshotObject = Readonly<Record<string, unknown>>;

export type InvoiceLineSnapshot = Readonly<{
  productId: string | null;
  position: number;
  skuSnapshot: string | null;
  nameSnapshot: string;
  descriptionSnapshot: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  lineSubtotal: string;
  lineTotal: string;
  currency: typeof SYSTEM_CURRENCY;
}>;

export type InvoiceCommercialSnapshot = Readonly<{
  origin: InvoiceOrigin;
  orderId: string | null;
  customerId: string;
  createdByUserId: string | null;
  currency: typeof SYSTEM_CURRENCY;
  subtotal: string;
  shippingTotal: string;
  taxTotal: string;
  total: string;
  issuerSnapshot: SnapshotObject;
  customerSnapshot: SnapshotObject;
  lines: readonly InvoiceLineSnapshot[];
}>;

export type InvoiceSnapshot = InvoiceCommercialSnapshot &
  Readonly<{
    id: string;
    number: string | null;
    status: InvoiceStatus;
    createdAt: string;
    updatedAt: string;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
    voidedAt: string | null;
  }>;

const TRANSITIONS: Readonly<
  Record<InvoiceStatus, readonly InvoiceStatus[]>
> = {
  DRAFT: ["PENDING_PAYMENT", "VOID"],
  PENDING_PAYMENT: ["PAID", "VOID"],
  PAID: ["VOID"],
  VOID: [],
};

export class InvalidInvoiceTransitionError extends Error {
  readonly code = "INVOICE_INVALID_TRANSITION";

  constructor(
    readonly from: InvoiceStatus,
    readonly to: InvoiceStatus,
  ) {
    super(`Invoice cannot transition from ${from} to ${to}`);
    this.name = "InvalidInvoiceTransitionError";
  }
}

function cents(value: string): bigint {
  if (!/^\d{1,12}\.\d{2}$/.test(value)) {
    throw new TypeError(
      "Invoice amounts must be nonnegative fixed-precision decimals",
    );
  }
  return BigInt(value.replace(".", ""));
}

function taxRateUnits(value: string): bigint {
  if (!/^\d{1,3}\.\d{4}$/.test(value)) {
    throw new TypeError("Invoice tax rates require four decimal places");
  }
  const units = BigInt(value.replace(".", ""));
  if (units > 1_000_000n) {
    throw new TypeError("Invoice tax rates cannot exceed 100 percent");
  }
  return units;
}

function isSnapshotObject(value: SnapshotObject): boolean {
  return value !== null && !Array.isArray(value);
}

function isValidDate(value: string | null): value is string {
  return value !== null && Number.isFinite(Date.parse(value));
}

export function invoiceNumberFor(invoiceId: string): string {
  if (!invoiceId.trim()) throw new TypeError("Invoice id is required");
  return `INV-${invoiceId.toUpperCase()}`;
}

export function assertInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new InvalidInvoiceTransitionError(from, to);
  }
}

function validate(snapshot: InvoiceSnapshot): void {
  if (!snapshot.id.trim() || !INVOICE_ORIGINS.includes(snapshot.origin)) {
    throw new TypeError("Invoice identity and origin are required");
  }
  if (!INVOICE_STATUSES.includes(snapshot.status)) {
    throw new TypeError("Invalid invoice status");
  }
  if (
    (snapshot.origin === "MANUAL" && snapshot.orderId !== null) ||
    (snapshot.origin === "ORDER" && !snapshot.orderId?.trim())
  ) {
    throw new TypeError("Invoice origin and order reference are inconsistent");
  }
  if (
    !snapshot.customerId.trim() ||
    snapshot.currency !== SYSTEM_CURRENCY ||
    !isSnapshotObject(snapshot.issuerSnapshot) ||
    !isSnapshotObject(snapshot.customerSnapshot) ||
    snapshot.lines.length === 0
  ) {
    throw new TypeError("Invoice requires customer, USD and snapshots");
  }

  let subtotal = 0n;
  let taxTotal = 0n;
  const positions = new Set<number>();
  for (const line of snapshot.lines) {
    if (
      !Number.isSafeInteger(line.position) ||
      line.position <= 0 ||
      positions.has(line.position) ||
      !line.nameSnapshot.trim() ||
      !line.descriptionSnapshot.trim() ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0 ||
      line.currency !== SYSTEM_CURRENCY
    ) {
      throw new TypeError("Invalid or duplicate invoice line");
    }
    if (line.productId !== null && !line.productId.trim()) {
      throw new TypeError("Invalid invoice line product reference");
    }
    if (line.skuSnapshot !== null && !line.skuSnapshot.trim()) {
      throw new TypeError("Invalid invoice line SKU snapshot");
    }
    positions.add(line.position);
    taxRateUnits(line.taxRate);
    const lineSubtotal = cents(line.unitPrice) * BigInt(line.quantity);
    const taxAmount = cents(line.taxAmount);
    if (
      cents(line.lineSubtotal) !== lineSubtotal ||
      cents(line.lineTotal) !== lineSubtotal + taxAmount
    ) {
      throw new TypeError("Inconsistent invoice line totals");
    }
    subtotal += lineSubtotal;
    taxTotal += taxAmount;
  }

  if (
    cents(snapshot.subtotal) !== subtotal ||
    cents(snapshot.taxTotal) !== taxTotal ||
    cents(snapshot.total) !==
      subtotal + taxTotal + cents(snapshot.shippingTotal)
  ) {
    throw new TypeError("Inconsistent invoice totals");
  }

  if (
    !isValidDate(snapshot.createdAt) ||
    !isValidDate(snapshot.updatedAt) ||
    Date.parse(snapshot.updatedAt) < Date.parse(snapshot.createdAt)
  ) {
    throw new TypeError("Invalid invoice lifecycle dates");
  }

  const issued = snapshot.status === "PENDING_PAYMENT" || snapshot.status === "PAID";
  if (
    (issued &&
      (!snapshot.number?.trim() || !isValidDate(snapshot.issuedAt))) ||
    (snapshot.status === "DRAFT" &&
      (snapshot.number !== null || snapshot.issuedAt !== null)) ||
    (snapshot.status === "VOID" &&
      ((snapshot.number === null) !== (snapshot.issuedAt === null))) ||
    (snapshot.number !== null && snapshot.number.length > 64)
  ) {
    throw new TypeError("Invoice number and issue date are inconsistent");
  }
  if (
    isValidDate(snapshot.issuedAt) &&
    Date.parse(snapshot.issuedAt) < Date.parse(snapshot.createdAt)
  ) {
    throw new TypeError("Invoice cannot be issued before creation");
  }
  if (
    snapshot.dueAt !== null &&
    (!isValidDate(snapshot.dueAt) ||
      !isValidDate(snapshot.issuedAt) ||
      Date.parse(snapshot.dueAt) < Date.parse(snapshot.issuedAt))
  ) {
    throw new TypeError("Invoice due date must follow issuance");
  }
  if (
    (snapshot.status === "PAID" && snapshot.paidAt === null) ||
    ((snapshot.status === "DRAFT" || snapshot.status === "PENDING_PAYMENT") &&
      snapshot.paidAt !== null) ||
    (snapshot.paidAt !== null &&
      (!isValidDate(snapshot.paidAt) ||
        !isValidDate(snapshot.issuedAt) ||
        Date.parse(snapshot.paidAt) < Date.parse(snapshot.issuedAt)))
  ) {
    throw new TypeError("Invoice payment date is inconsistent");
  }
  if (
    (snapshot.status === "VOID") !== (snapshot.voidedAt !== null) ||
    (snapshot.voidedAt !== null &&
      (!isValidDate(snapshot.voidedAt) ||
        Date.parse(snapshot.voidedAt) < Date.parse(snapshot.createdAt)))
  ) {
    throw new TypeError("Invoice void date is inconsistent");
  }
}

/** Commercial snapshots are copied on every boundary and never edited by transitions. */
export class InvoiceAggregate {
  readonly #snapshot: InvoiceSnapshot;

  private constructor(snapshot: InvoiceSnapshot) {
    validate(snapshot);
    this.#snapshot = structuredClone(snapshot);
  }

  static createDraft(
    input: InvoiceCommercialSnapshot,
    now = new Date(),
  ): InvoiceAggregate {
    return new InvoiceAggregate({
      ...input,
      id: randomUUID(),
      number: null,
      status: "DRAFT",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      issuedAt: null,
      dueAt: null,
      paidAt: null,
      voidedAt: null,
    });
  }

  static restore(snapshot: InvoiceSnapshot): InvoiceAggregate {
    return new InvoiceAggregate(snapshot);
  }

  get snapshot(): InvoiceSnapshot {
    return structuredClone(this.#snapshot);
  }

  transition(to: InvoiceStatus, now = new Date()): InvoiceAggregate {
    const from = this.#snapshot.status;
    assertInvoiceTransition(from, to);
    if (now.getTime() < Date.parse(this.#snapshot.updatedAt)) {
      throw new TypeError("Invoice transition cannot precede its last update");
    }

    const issuing = from === "DRAFT" && to === "PENDING_PAYMENT";
    return new InvoiceAggregate({
      ...this.#snapshot,
      number: issuing ? invoiceNumberFor(this.#snapshot.id) : this.#snapshot.number,
      status: to,
      updatedAt: now.toISOString(),
      issuedAt: issuing ? now.toISOString() : this.#snapshot.issuedAt,
      paidAt: to === "PAID" ? now.toISOString() : this.#snapshot.paidAt,
      voidedAt: to === "VOID" ? now.toISOString() : null,
    });
  }
}
