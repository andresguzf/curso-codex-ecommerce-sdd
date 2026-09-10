import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe("customer invoices REST client", () => {
  it("requests only the backend page with the customer bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], page: 2, pageSize: 20, totalItems: 0, totalPages: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getMyInvoices } = await import("../src/features/invoices/invoice-api");
    await getMyInvoices("token", { page: 2, pageSize: 20 });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/v1/invoices?page=2&pageSize=20&sortBy=createdAt&sortOrder=desc");
    expect(request.url).not.toContain("customerId=");
    expect(request.headers.get("Authorization")).toBe("Bearer token");
    expect(request.cache).toBe("no-store");
  });

  it("maps an ajena invoice to a safe not-found error and rejects malformed data", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ message: "other customer secret" }, { status: 404 })).mockResolvedValueOnce(Response.json({ items: "invalid" }));
    vi.stubGlobal("fetch", fetchMock);
    const { getMyInvoice, getMyInvoices } = await import("../src/features/invoices/invoice-api");
    await expect(getMyInvoice("token", "foreign-id")).rejects.toMatchObject({ status: 404, message: "No encontramos esta factura en tu cuenta." });
    await expect(getMyInvoices("token", { page: 1, pageSize: 20 })).rejects.toThrow();
  });
});
