import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate";
import type { OrderSnapshot } from "../order-management/order.aggregate";
import type { PdfDocument } from "./pdf-renderer.port";

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

export function orderDocumentTemplate(order: OrderSnapshot): PdfDocument {
  const customer = order.customerSnapshot;
  const payment = order.paymentSnapshot;
  return {
    title: `ORDEN DE COMPRA ${order.number}`,
    lines: [
      `Estado: ${order.status}`,
      `Fecha: ${date(order.createdAt)}`,
      `Cliente: ${snapshotText(customer, "displayName")}`,
      `Email: ${snapshotText(customer, "email")}`,
      `Direccion de entrega: ${address(order.shippingAddressSnapshot)}`,
      `Envio: ${snapshotText(order.shippingMethodSnapshot, "name", "method")} · ${money(order.shippingTotal)}`,
      `Pago: ${snapshotText(payment, "status")} · ${snapshotText(payment, "method")}`,
      "PRODUCTOS",
      ...order.items.map((item) => `${item.name} | SKU ${item.sku} | Cantidad ${item.quantity} | Unitario ${money(item.unitPrice)} | Total ${money(item.lineTotal)}`),
      `Subtotal: ${money(order.subtotal)}`,
      `Impuestos: ${money(order.taxTotal)}`,
      `Total: ${money(order.total)}`,
      "Documento generado desde los snapshots historicos de la orden.",
    ],
  };
}

export function invoiceDocumentTemplate(invoice: InvoiceSnapshot): PdfDocument {
  const issuer = invoice.issuerSnapshot;
  const customer = invoice.customerSnapshot;
  const draftLabel = invoice.status === "DRAFT" ? "BORRADOR · sin numero definitivo" : `Numero: ${invoice.number ?? "No registrado"}`;
  return {
    title: `FACTURA ${invoice.number ?? "BORRADOR"}`,
    lines: [
      draftLabel,
      `Estado: ${invoice.status}`,
      `Origen: ${invoice.origin === "ORDER" ? "Orden de compra" : "Manual"}`,
      `Fecha: ${date(invoice.createdAt)}`,
      `Emisor: ${snapshotText(issuer, "tradeName", "commercialName", "legalName", "name")}`,
      `Razon social: ${snapshotText(issuer, "legalName", "businessName")}`,
      `Identificador fiscal: ${snapshotText(issuer, "taxId", "taxIdentifier")}`,
      `Direccion del emisor: ${address(issuer)}`,
      `Cliente: ${snapshotText(customer, "displayName")}`,
      `Email: ${snapshotText(customer, "email")}`,
      "LINEAS",
      ...invoice.lines.map((line) => `${line.nameSnapshot} | ${line.skuSnapshot ?? "Linea manual"} | Cantidad ${line.quantity} | Unitario ${money(line.unitPrice)} | Impuesto ${money(line.taxAmount)} | Total ${money(line.lineTotal)}`),
      `Subtotal: ${money(invoice.subtotal)}`,
      `Impuestos: ${money(invoice.taxTotal)}`,
      `Total: ${money(invoice.total)}`,
      "Documento generado desde los snapshots historicos de la factura.",
    ],
  };
}
