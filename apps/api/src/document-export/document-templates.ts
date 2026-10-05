import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate.js";
import type { OrderSnapshot } from "../order-management/order.aggregate.js";
import type { PdfDocument } from "./pdf-renderer.port.js";

function snapshotText(snapshot: Readonly<Record<string, unknown>>, ...keys: string[]): string {
  for (const key of keys) {
    const value = snapshot[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "No registrado";
}

function money(value: string): string {
  return `${value} USD`;
}

function date(value: string | null): string {
  return value ? new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "America/Santiago" }).format(new Date(value)) : "No registrada";
}

function address(snapshot: Readonly<Record<string, unknown>>): string {
  return ["recipientName", "line1", "line2", "city", "region", "postalCode", "countryCode"]
    .map((key) => snapshotText(snapshot, key))
    .filter((value) => value !== "No registrado")
    .join(", ") || "No registrada";
}

function issuerHeader(snapshot: unknown): string[] {
  if (!snapshot || typeof snapshot !== "object") return [];
  const issuer = snapshot as Readonly<Record<string, unknown>>;
  const nestedAddress = issuer.address && typeof issuer.address === "object"
    ? issuer.address as Readonly<Record<string, unknown>> : issuer;
  return [
    `Nombre comercial: ${snapshotText(issuer, "tradeName", "commercialName", "legalName")}`,
    `Razón social: ${snapshotText(issuer, "legalName", "businessName")}`,
    `Identificador fiscal: ${snapshotText(issuer, "taxIdentifier", "taxId")}`,
    `Dirección del emisor: ${address(nestedAddress)}`,
  ];
}

export function orderDocumentTemplate(order: OrderSnapshot): PdfDocument {
  const customer = order.customerSnapshot;
  const payment = order.paymentSnapshot;
  return {
    title: `ORDEN DE COMPRA ${order.number}`,
    issuerLines: issuerHeader(order.issuerSnapshot),
    lines: [
      `Estado: ${order.status}`,
      `Fecha: ${date(order.createdAt)}`,
      `Cliente: ${snapshotText(customer, "displayName")}`,
      `Email: ${snapshotText(customer, "email")}`,
      `Dirección de entrega: ${address(order.shippingAddressSnapshot)}`,
      `Envío: ${snapshotText(order.shippingMethodSnapshot, "name", "method")} · ${money(order.shippingTotal)}`,
      `Pago: ${snapshotText(payment, "status")} · ${snapshotText(payment, "method")}`,
    ],
    table: { headers: ["Producto / SKU", "Cantidad", "Unitario", "Impuestos", "Importe"],
      rows: order.items.map((item) => [ `${item.name}\nSKU ${item.sku}`, String(item.quantity), item.unitPrice, item.taxAmount, item.lineTotal ]) },
    totals: [
      `Subtotal: ${money(order.subtotal)}`,
      `Impuestos: ${money(order.taxTotal)}`,
      `Envío: ${money(order.shippingTotal)}`,
      `Total: ${money(order.total)}`,
    ],
  };
}

export function invoiceDocumentTemplate(invoice: InvoiceSnapshot): PdfDocument {
  const issuer = invoice.issuerSnapshot;
  const customer = invoice.customerSnapshot;
  const draftLabel = invoice.status === "DRAFT" ? "BORRADOR · sin número definitivo" : `Número: ${invoice.number ?? "No registrado"}`;
  return {
    title: `FACTURA ${invoice.number ?? "BORRADOR"}`,
    issuerLines: issuerHeader(issuer),
    lines: [
      draftLabel,
      `Estado: ${invoice.status}`,
      `Origen: ${invoice.origin === "ORDER" ? "Orden de compra" : "Manual"}`,
      `Fecha: ${date(invoice.createdAt)}`,
      `Cliente: ${snapshotText(customer, "displayName")}`,
      `Email: ${snapshotText(customer, "email")}`,
    ],
    table: { headers: ["Producto / SKU", "Cantidad", "Unitario", "Impuestos", "Importe"],
      rows: invoice.lines.map((line) => [ `${line.nameSnapshot}\n${line.skuSnapshot ?? "Línea manual"}`, String(line.quantity), line.unitPrice, line.taxAmount, line.lineTotal ]) },
    totals: [
      `Subtotal: ${money(invoice.subtotal)}`,
      `Impuestos: ${money(invoice.taxTotal)}`,
      ...(invoice.shippingTotal !== "0.00" ? [`Envío: ${money(invoice.shippingTotal)}`] : []),
      `Total: ${money(invoice.total)}`,
    ],
  };
}
