import { afterEach, describe, expect, it, vi } from "vitest";

const customer = { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente demo", email: "client@example.com", role: "CUSTOMER", status: "ACTIVE", deletedAt: null, createdAt: "2026-09-09T12:00:00Z", updatedAt: "2026-09-09T12:00:00Z" };
const product = { id: customer.id, name: "Teclado", description: "Mecánico", sku: "NOVA", slug: "teclado", category: null, tags: [], currency: "USD", price: "89.50", stockAvailable: 0, status: "ACTIVE", image: { storageKey: "nova", url: "/placeholder.svg" }, coverImage: { id: customer.id, storageKey: "nova", url: "/placeholder.svg", altText: "Portada del teclado", isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null }, createdAt: customer.createdAt, updatedAt: customer.updatedAt };
const page = (item: unknown) => ({ items: [item], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("invoice lookup REST adapters", () => {
  it("requests only bounded authenticated autocomplete pages and forwards cancellation", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json(page(customer))).mockResolvedValueOnce(Response.json(page(product)));
    vi.stubGlobal("fetch", fetch);
    const api = await import("../src/features/invoices/invoice-autocomplete-api");
    const controller = new AbortController();
    expect(await api.searchInvoiceCustomers("billing-token", " demo ", controller.signal)).toEqual([customer]);
    expect(await api.searchInvoiceProducts("billing-token", "Teclado", controller.signal)).toEqual([product]);
    for (const [request] of fetch.mock.calls as [Request][]) {
      const query = new URL(request.url).searchParams;
      expect(query.get("purpose")).toBe("autocomplete");
      expect(query.get("page")).toBe("1");
      expect(query.get("pageSize")).toBe("20");
      expect(request.headers.get("Authorization")).toBe("Bearer billing-token");
      expect(request.credentials).toBe("include");
      controller.abort();
      expect(request.signal.aborted).toBe(true);
    }
  });
  it("rejects untrusted inactive records, unauthorized users and oversized pages", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(Response.json(page({ ...customer, role: "ADMIN" })))
      .mockResolvedValueOnce(Response.json(page({ ...product, status: "INACTIVE" })))
      .mockResolvedValueOnce(Response.json({ ...page(customer), items: Array(21).fill(customer) })));
    const api = await import("../src/features/invoices/invoice-autocomplete-api");
    const signal = new AbortController().signal;
    await expect(api.searchInvoiceCustomers("token", "demo", signal)).rejects.toThrow();
    await expect(api.searchInvoiceProducts("token", "demo", signal)).rejects.toThrow();
    await expect(api.searchInvoiceCustomers("token", "demo", signal)).rejects.toThrow();
  });
  it("avoids short searches and does not expose server error details", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ message: "private SQL details" }, { status: 403 }));
    vi.stubGlobal("fetch", fetch);
    const api = await import("../src/features/invoices/invoice-autocomplete-api");
    const signal = new AbortController().signal;
    await expect(api.searchInvoiceCustomers("token", "ab", signal)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    await expect(api.searchInvoiceCustomers("token", "demo", signal)).rejects.toThrow("No se pudo buscar clientes.");
  });
});
