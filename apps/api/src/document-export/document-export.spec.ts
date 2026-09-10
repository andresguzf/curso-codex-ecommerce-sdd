import { describe, expect, it } from "vitest";

import { DocumentExportService } from "./document-export.service";
import { SimplePdfAdapter } from "./simple-pdf.adapter";
import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate";
import type { OrderSnapshot } from "../order-management/order.aggregate";

const order: OrderSnapshot = {
  id: "16f7d829-e4c8-4a78-a883-4e21b2d8a957",
  number: "ORD-HISTORIC-PDF",
  status: "PROCESSING",
  customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  customerSnapshot: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente historico", email: "historic@example.com" },
  shippingAddressSnapshot: { recipientName: "Destinatario", line1: "Calle Historica 123", city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
  shippingMethodSnapshot: { method: "STANDARD", name: "Envio historico" },
  paymentSnapshot: { status: "APPROVED", method: "SIMULATED_CARD_APPROVED" },
  currency: "USD", subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00",
  items: [{ productId: "6040fbbe-923e-4763-a6b9-a65d69536bf8", sku: "TECH-HIST", name: "Teclado historico", quantity: 1, unitPrice: "100.00", lineTotal: "100.00", taxAmount: "0.00", currency: "USD" }],
  createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", cancelledAt: null,
};

const invoice: InvoiceSnapshot = {
  id: "16f7d829-e4c8-4a78-a883-4e21b2d8a957", number: null, origin: "MANUAL", status: "DRAFT", orderId: null, customerId: order.customerId, createdByUserId: null, currency: "USD",
  subtotal: "100.00", shippingTotal: "0.00", taxTotal: "0.00", total: "100.00", issuerSnapshot: { legalName: "Tienda Historica", taxId: "TAX-123", secret: "DO-NOT-PRINT" }, customerSnapshot: { displayName: "Cliente historico", email: "historic@example.com" },
  lines: [{ productId: null, position: 1, skuSnapshot: null, nameSnapshot: "Servicio tecnico", descriptionSnapshot: "Servicio historico", quantity: 1, unitPrice: "100.00", taxRate: "0.0000", taxAmount: "0.00", lineSubtotal: "100.00", lineTotal: "100.00", currency: "USD" }],
  createdAt: "2026-09-01T12:00:00.000Z", updatedAt: "2026-09-01T12:00:00.000Z", issuedAt: null, dueAt: null, paidAt: null, voidedAt: null,
};

describe("document export", () => {
  const service = new DocumentExportService(new SimplePdfAdapter());

  it("renders a valid order PDF from its historical snapshot", () => {
    const pdf = service.renderOrder(order);
    const source = pdf.toString("latin1");
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(source).toContain("ORDEN DE COMPRA ORD-HISTORIC-PDF");
    expect(source).toContain("Teclado historico");
    expect(source).toContain("Total: 105.00 USD");
    expect(source).toContain("%%EOF");
  });

  it("marks draft invoices and excludes unknown snapshot fields", () => {
    const pdf = service.renderInvoice(invoice);
    const source = pdf.toString("latin1");
    expect(source).toContain("FACTURA BORRADOR");
    expect(source).toContain("BORRADOR ");
    expect(source).toContain("Tienda Historica");
    expect(source).toContain("Servicio tecnico");
    expect(source).not.toContain("DO-NOT-PRINT");
  });

  it("does not depend on live catalog or customer objects", () => {
    const historic = { ...order, customerSnapshot: { ...order.customerSnapshot, displayName: "Nombre congelado" }, items: [{ ...order.items[0], name: "Producto congelado" }] };
    const source = service.renderOrder(historic).toString("latin1");
    expect(source).toContain("Nombre congelado");
    expect(source).toContain("Producto congelado");
    expect(source).not.toContain("Cliente historico");
    expect(source).not.toContain("Teclado historico");
  });

  it("regenerates the same draft invoice after related master data changes", () => {
    const orderBefore = service.renderOrder(order);
    const before = service.renderInvoice(invoice);
    const changedMasterData = {
      customerName: "Cliente actualizado",
      productName: "Servicio actualizado",
      productPrice: "999.00",
    };
    const orderAfter = service.renderOrder(order);
    const after = service.renderInvoice(invoice);
    const orderSource = orderAfter.toString("latin1");
    const source = after.toString("latin1");

    expect(orderAfter.equals(orderBefore)).toBe(true);
    expect(orderSource).toContain("Cliente historico");
    expect(orderSource).toContain("Teclado historico");
    expect(orderSource).not.toContain(changedMasterData.customerName);
    expect(orderSource).not.toContain(changedMasterData.productName);
    expect(after.equals(before)).toBe(true);
    expect(source).toContain("FACTURA BORRADOR");
    expect(source).toContain("BORRADOR ");
    expect(source).toContain("Cliente historico");
    expect(source).toContain("Servicio tecnico");
    expect(source).not.toContain(changedMasterData.customerName);
    expect(source).not.toContain(changedMasterData.productName);
    expect(source).not.toContain(changedMasterData.productPrice);
  });
});
