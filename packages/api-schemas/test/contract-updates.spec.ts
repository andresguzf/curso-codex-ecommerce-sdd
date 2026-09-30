import { describe, expect, it } from "vitest";

import { createManualInvoiceRequestSchema, productListQuerySchema, userListQuerySchema } from "../src";

const customerId = "3296f1d5-5a1d-4b94-9caa-b26878f447e4";
const productId = "421d45a3-104e-4413-b79f-25290d1cb0a3";
const line = { productId, quantity: 1, unitPrice: "89.50", taxRate: "19.0000" };

describe("contracts introduced through phase 17", () => {
  it.each([userListQuerySchema, productListQuerySchema])("validates bounded autocomplete and rejects missing/short search or oversized pages", (schema) => {
    expect(schema.safeParse({ purpose: "autocomplete", search: " Demo ", pageSize: "20" }).success).toBe(true);
    for (const query of [{}, { search: "ab" }, { search: "   " }, { search: "demo", pageSize: 21 }, { search: "demo", page: 1_000_001 }]) {
      expect(schema.safeParse({ purpose: "autocomplete", ...query }).success).toBe(false);
    }
  });
  it("enforces the scopes of customer and product autocomplete", () => {
    expect(userListQuerySchema.safeParse({ purpose: "autocomplete", search: "demo", role: "BILLING" }).success).toBe(false);
    expect(userListQuerySchema.safeParse({ purpose: "autocomplete", search: "demo", status: "BLOCKED" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ purpose: "autocomplete", search: "demo", view: "administrative" }).success).toBe(false);
    expect(productListQuerySchema.safeParse({ purpose: "autocomplete", search: "demo", status: "ACTIVE" }).success).toBe(false);
  });
  it("accepts administrative product dates, validates the range and denies public date filters", () => {
    const query = { view: "administrative", createdFrom: "2026-09-01", createdTo: "2026-09-30", minPrice: "10.00", maxPrice: "99.99" };
    expect(productListQuerySchema.safeParse(query).success).toBe(true);
    for (const changes of [{ createdFrom: "2026-02-30" }, { createdTo: "2026-08-31" }, { view: "public" }]) {
      expect(productListQuerySchema.safeParse({ ...query, ...changes }).success).toBe(false);
    }
  });
  it("distinguishes referenced products from custom lines and bounds taxes safely", () => {
    expect(createManualInvoiceRequestSchema.safeParse({ customerId, lines: [line] }).success).toBe(true);
    expect(createManualInvoiceRequestSchema.safeParse({ customerId, lines: [{ ...line, productId: null, name: "Servicio", description: "Instalación" }] }).success).toBe(true);
    expect(createManualInvoiceRequestSchema.safeParse({ customerId, lines: [{ ...line, productId: null }] }).success).toBe(false);
    for (const taxRate of ["100.0001", "101.0000", "abc", "Infinity", "-1.0000", "19.00"]) {
      expect(createManualInvoiceRequestSchema.safeParse({ customerId, lines: [{ ...line, taxRate }] }).success).toBe(false);
    }
    for (const taxRate of ["0.0000", "000.0000", "019.0000", "99.9999", "100.0000"]) {
      expect(createManualInvoiceRequestSchema.safeParse({ customerId, lines: [{ ...line, taxRate }] }).success).toBe(true);
    }
  });
});
