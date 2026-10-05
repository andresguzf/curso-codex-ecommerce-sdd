import { describe, expect, it, vi } from "vitest";
import { COMPANY_LOGO_BYTES, companyLogoReference } from "../billing-invoicing/company-logo";
import { DocumentExportService } from "./document-export.service";
import { SimplePdfAdapter } from "./simple-pdf.adapter";
import type { ImageStorageService } from "../product-catalog/image-storage/image-storage.service";
import type { OrderSnapshot } from "../order-management/order.aggregate";

describe("structured PDF", () => {
  it("paginates all rows and repeats headers without silently trimming text", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [`Producto-${i} teclado tecnológico\nSKU-${i}`, "2", "12.00", "0.00", "24.00"]);
    const pdf = await new SimplePdfAdapter().render({ title: "FACTURA DEMO", lines: ["Cliente: José Muñoz"],
      logo: { data: COMPANY_LOGO_BYTES, mimeType: "image/svg+xml" },
      table: { headers: ["Producto / SKU", "Cantidad", "Unitario", "Impuestos", "Importe"], rows }, totals: ["Total: 2880.00 USD"] });
    const source = pdf.toString("latin1");
    for (let i = 0; i < 120; i++) expect(source).toContain(`SKU-${i})`);
    expect(source).toContain("José Muñoz");
    expect(source).toContain("Total: 2880.00 USD");
    expect(source.match(/Producto \/ SKU/g)!.length).toBeGreaterThan(1);
    expect(source).toContain("/Logo Do");
    expect(source).not.toContain("/Count 1 >>");
  });
  it("continues oversized rows and never edits input snapshots", async () => {
    const name = "Descripción extensa ".repeat(300) + "ULTIMO-TEXTO";
    const document = { title: "ORDEN", lines: [], table: { headers: ["Producto", "Cantidad", "Unitario", "Impuestos", "Importe"], rows: [[name, "1", "10.00", "0.00", "10.00"]] }, totals: ["Total: 10.00 USD"] };
    const before = structuredClone(document);
    const source = (await new SimplePdfAdapter().render(document)).toString("latin1");
    expect(source).toContain("ULTIMO-TEXTO");
    expect(source).toContain("Total: 10.00 USD");
    expect(document).toEqual(before);
  });
  it("resolves the trusted fixed SVG by version without reading mutable storage", async () => {
    const read = vi.fn();
    const renderer = { render: vi.fn().mockResolvedValue(Buffer.from("PDF")) };
    const service = new DocumentExportService(renderer, { read } as unknown as ImageStorageService);
    await service.renderOrder({ number: "ORD-1", status: "PROCESSING", createdAt: "2026-10-05T12:00:00Z", items: [],
      issuerSnapshot: { logo: companyLogoReference() }, customerSnapshot: {}, shippingAddressSnapshot: {}, shippingMethodSnapshot: {},
      paymentSnapshot: {}, shippingTotal: "0.00", subtotal: "0.00", taxTotal: "0.00", total: "0.00" } as unknown as OrderSnapshot);
    expect(read).not.toHaveBeenCalled();
    expect(renderer.render.mock.calls[0]?.[0].logo.data).toEqual(COMPANY_LOGO_BYTES);
  });
});
