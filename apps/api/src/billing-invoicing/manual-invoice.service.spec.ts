import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../database/database.service";
import { ManualInvoiceService, type ManualInvoiceRequest } from "./manual-invoice.service";

describe("manual invoice service boundary", () => {
  it("rejects invalid internal requests before starting a transaction", () => {
    const transaction = vi.fn();
    const service = new ManualInvoiceService({ client: { transaction } } as unknown as DatabaseService);
    const actor = { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "admin@example.com", displayName: "Admin", role: "ADMIN" as const };
    const request = { customerId: actor.id, shippingTotal: "0.00", lines: [{ productId: null, name: "Servicio", description: "Instalación", quantity: 1, unitPrice: "10.00", taxRate: "0.0000" }] };
    for (const invalid of [
      { ...request, customerId: "fake" },
      { ...request, lines: [{ ...request.lines[0], quantity: -1 }] },
      { ...request, lines: [{ ...request.lines[0], taxRate: "101.0000" }] },
      { ...request, lines: [{ ...request.lines[0], taxRate: "abc" }] },
      { ...request, lines: [{ ...request.lines[0], unitPrice: "-10.00" }] },
    ]) {
      expect(() => service.create(actor, invalid as ManualInvoiceRequest)).toThrow("Invalid manual invoice request");
    }
    expect(transaction).not.toHaveBeenCalled();
  });
});
