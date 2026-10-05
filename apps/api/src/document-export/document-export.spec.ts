import { createHash } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { DocumentExportService } from "./document-export.service";
import { SimplePdfAdapter } from "./simple-pdf.adapter";
import type { InvoiceSnapshot } from "../billing-invoicing/invoice.aggregate";
import type { OrderSnapshot } from "../order-management/order.aggregate";
import { ImageStorageService } from "../product-catalog/image-storage/image-storage.service";
import type { ImageStorage } from "../product-catalog/image-storage/image-storage.port";
import type { ImageReferenceLookup } from "../product-catalog/image-storage/image-reference.repository";
import { CatalogImageStorageRouter } from "../product-catalog/image-storage/catalog-image-storage-router";
import { ImageStorageNotFoundError } from "../product-catalog/image-storage/image-storage.port";

const order: OrderSnapshot = {
  id: "16f7d829-e4c8-4a78-a883-4e21b2d8a957",
  number: "ORD-HISTORIC-PDF",
  status: "PROCESSING",
  customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  customerSnapshot: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente historico", email: "historic@example.com" },
  issuerSnapshot: null,
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
  const read = vi.fn();
  const service = new DocumentExportService(new SimplePdfAdapter(), { read } as unknown as ImageStorageService);

  it("renders a valid order PDF from its historical snapshot", async () => {
    const pdf = await service.renderOrder(order);
    const source = pdf.toString("latin1");
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(source).toContain("ORDEN DE COMPRA");
    expect(source).toContain("ORD-HISTORIC-PDF");
    expect(source).toContain("Teclado historico");
    expect(source).toContain("Total: 105.00 USD");
    expect(source).toContain("%%EOF");
  });

  it("marks draft invoices and excludes unknown snapshot fields", async () => {
    const pdf = await service.renderInvoice(invoice);
    const source = pdf.toString("latin1");
    expect(source).toContain("FACTURA BORRADOR");
    expect(source).toContain("BORRADOR ");
    expect(source).toContain("Tienda Historica");
    expect(source).toContain("Servicio tecnico");
    expect(source).not.toContain("DO-NOT-PRINT");
  });

  it("does not depend on live catalog or customer objects", async () => {
    const historic = { ...order, customerSnapshot: { ...order.customerSnapshot, displayName: "Nombre congelado" }, items: [{ ...order.items[0], name: "Producto congelado" }] };
    const source = (await service.renderOrder(historic)).toString("latin1");
    expect(source).toContain("Nombre congelado");
    expect(source).toContain("Producto congelado");
    expect(source).not.toContain("Cliente historico");
    expect(source).not.toContain("Teclado historico");
  });

  it("regenerates the same draft invoice after related master data changes", async () => {
    const orderBefore = await service.renderOrder(order);
    const before = await service.renderInvoice(invoice);
    const changedMasterData = {
      customerName: "Cliente actualizado",
      productName: "Servicio actualizado",
      productPrice: "999.00",
    };
    const orderAfter = await service.renderOrder(order);
    const after = await service.renderInvoice(invoice);
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

  it.each(["png", "jpeg", "webp"] as const)("embeds a verified historical %s logo in both document types", async (format) => {
    const data = await sharp({ create: { width: 120, height: 60, channels: 3, background: "#164a83" } })[format]().toBuffer();
    const sha256 = createHash("sha256").update(data).digest("hex");
    const logo = { storageKey: `historic-logo.${format}`, url: "https://ignored.example/new-logo", sha256 };
    const issuer = {
      tradeName: "Marca Histórica", legalName: "Empresa Histórica SpA", taxIdentifier: "RUT-HIST",
      address: { line1: "Calle Antigua 22", line2: null, city: "Santiago", region: null, postalCode: null, countryCode: "CL" },
      contact: { email: null, phone: null }, logo,
    };
    read.mockResolvedValue({ storageKey: logo.storageKey, url: "https://ignored.example/asset", mimeType: `image/${format}`, size: data.length, data });
    const orderPdf = await service.renderOrder({ ...order, issuerSnapshot: issuer });
    const invoicePdf = await service.renderInvoice({ ...invoice, issuerSnapshot: issuer });
    for (const pdf of [orderPdf, invoicePdf]) {
      const source = pdf.toString("latin1");
      expect(source).toContain("/Subtype /Image");
      expect(source).toContain("/Logo Do");
      expect(source).toContain("Marca Histórica");
      expect(source).toContain("Empresa Histórica SpA");
      expect(source).toContain("RUT-HIST");
      expect(source).toContain("Calle Antigua 22");
      expect(source).not.toContain("https://ignored.example");
    }
    expect(read).toHaveBeenCalledWith(logo.storageKey);
    read.mockReset();
  });

  it("omits logos from legacy snapshots and rejects missing or tampered managed assets", async () => {
    const legacy = { ...invoice, issuerSnapshot: { ...invoice.issuerSnapshot, logo: { storageKey: "old.svg", url: "https://old.example/logo.svg" } } };
    expect((await service.renderInvoice(legacy)).toString("latin1")).not.toContain("/Subtype /Image");
    const managed = { ...invoice, issuerSnapshot: { ...invoice.issuerSnapshot, logo: { storageKey: "lost.png", sha256: "a".repeat(64) } } };
    read.mockRejectedValueOnce(new ImageStorageNotFoundError("lost.png"));
    await expect(service.renderInvoice(managed)).rejects.toMatchObject({ response: { code: "DOCUMENT_LOGO_MISSING" } });
    read.mockResolvedValueOnce({ data: Buffer.from("different"), mimeType: "image/png" });
    await expect(service.renderInvoice(managed)).rejects.toMatchObject({ response: { code: "DOCUMENT_LOGO_TAMPERED" } });
    const unreadable = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("broken")]);
    read.mockResolvedValueOnce({ data: unreadable, mimeType: "image/png" });
    await expect(service.renderInvoice({ ...managed, issuerSnapshot: { ...managed.issuerSnapshot, logo: {
      storageKey: "broken.png", sha256: createHash("sha256").update(unreadable).digest("hex"),
    } } })).rejects.toMatchObject({ response: { code: "DOCUMENT_LOGO_UNREADABLE" } });
    read.mockReset();
  });

  it("preserves historical order/invoice snapshots and local logo PDFs through catalog provider switches", async () => {
    const data = await sharp({ create: { width: 32, height: 16, channels: 3, background: "navy" } }).png().toBuffer();
    const local = { upload: vi.fn(), read: vi.fn().mockResolvedValue({ data, mimeType: "image/png" }), delete: vi.fn() } as unknown as ImageStorage;
    const cloud = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as ImageStorage;
    const enterprise = new ImageStorageService(local, { isReferenced: vi.fn() } as unknown as ImageReferenceLookup);
    const documents = new DocumentExportService(new SimplePdfAdapter(), enterprise);
    const issuer = { tradeName: "Historical company", legalName: "Historical legal name", taxIdentifier: "HIST-001",
      address: { line1: "Historical street", line2: null, city: "Santiago", region: null, postalCode: null, countryCode: "CL" },
      contact: { email: null, phone: null }, logo: { storageKey: "f8c6ad19-ff10-4231-88fc-6f28897d6418.png", url: "https://unused.example/logo.png", sha256: createHash("sha256").update(data).digest("hex") } };
    const historicOrder = { ...order, issuerSnapshot: issuer };
    const historicInvoice = { ...invoice, issuerSnapshot: issuer };
    const originals = structuredClone({ historicOrder, historicInvoice });
    const firstOrder = await documents.renderOrder(historicOrder);
    const firstInvoice = await documents.renderInvoice(historicInvoice);
    for (const provider of ["cloudinary", "local", "cloudinary"] as const) {
      // Reconstruct the catalog's router as on deployment/restart. Enterprise
      // storage remains a separate local instance, never this catalog router.
      const catalog = new CatalogImageStorageRouter(local, cloud, provider);
      expect(catalog).not.toBe(enterprise);
      expect((await documents.renderOrder(historicOrder)).equals(firstOrder)).toBe(true);
      expect((await documents.renderInvoice(historicInvoice)).equals(firstInvoice)).toBe(true);
    }
    expect({ historicOrder, historicInvoice }).toEqual(originals);
    expect(local.read).toHaveBeenCalledWith(issuer.logo.storageKey);
    expect(cloud.read).not.toHaveBeenCalled();
    expect(cloud.upload).not.toHaveBeenCalled();
    expect(cloud.delete).not.toHaveBeenCalled();
    expect(firstOrder.toString("latin1")).toContain("/Logo Do");
    expect(firstInvoice.toString("latin1")).toContain("/Logo Do");
  });

  it("regenerates identical bytes after the current profile and logo change", async () => {
    const data = await sharp({ create: { width: 64, height: 32, channels: 3, background: "#164a83" } }).png().toBuffer();
    const historical = { ...order, issuerSnapshot: {
      tradeName: "Tienda Original", legalName: "Razón Original SpA", taxIdentifier: "TAX-OLD",
      address: { line1: "Calle Original 1", line2: null, city: "Santiago", region: null, postalCode: null, countryCode: "CL" },
      contact: { email: null, phone: null },
      logo: { storageKey: "original.png", url: "https://unused.example/original.png", sha256: createHash("sha256").update(data).digest("hex") },
    } };
    read.mockResolvedValue({ data, mimeType: "image/png" });
    const first = await service.renderOrder(historical);
    const currentProfile = { tradeName: "Tienda Nueva", logo: "new.png" };
    const second = await service.renderOrder(historical);
    expect(second.equals(first)).toBe(true);
    expect(second.toString("latin1")).not.toContain(currentProfile.tradeName);
    expect(read).toHaveBeenCalledWith("original.png");
    read.mockReset();
  });
});
