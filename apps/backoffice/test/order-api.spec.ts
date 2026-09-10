import { afterEach, describe, expect, it, vi } from "vitest";

const summary = {
  id: "421d45a3-104e-4413-b79f-25290d1cb0a3", number: "ORD-001", status: "INVOICED", currency: "USD",
  subtotal: "100.00", shippingTotal: "5.00", taxTotal: "0.00", total: "105.00",
  createdAt: "2026-09-09T12:00:00Z", updatedAt: "2026-09-09T12:00:00Z", cancelledAt: null,
};

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("administrative orders REST client", () => {
  it("sends backend pagination, all filters, sorting and bearer credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], page: 3, pageSize: 20, totalItems: 0, totalPages: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const { listOrders } = await import("../src/features/orders/order-api");
    await listOrders("admin-token", {
      page: 3, pageSize: 20, search: "ORD", customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", status: "PROCESSING",
      createdFrom: "2026-09-01", createdTo: "2026-09-30", invoicing: "NO_ACTIVE_INVOICE", sortBy: "total", sortOrder: "asc",
    });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.get("Authorization")).toBe("Bearer admin-token");
    expect(request.url).toContain("/api/v1/orders?");
    for (const part of ["page=3", "pageSize=20", "search=ORD", "status=PROCESSING", "invoicing=NO_ACTIVE_INVOICE", "sortBy=total", "sortOrder=asc", "createdFrom=2026-09-01T00%3A00%3A00.000Z", "createdTo=2026-09-30T23%3A59%3A59.999Z"]) expect(request.url).toContain(part);
  });
  it("uses dedicated detail, completion and cancellation operations", async () => {
    const detail = { ...summary, customerSnapshot: {}, shippingAddressSnapshot: {}, shippingMethodSnapshot: {}, paymentSnapshot: {}, items: [{ productId: "6040fbbe-923e-4763-a6b9-a65d69536bf8", sku: "SKU", name: "Producto", quantity: 1, unitPrice: "100.00", taxAmount: "0.00", lineTotal: "100.00", currency: "USD" }] };
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(detail)).mockResolvedValueOnce(Response.json({ ...summary, status: "COMPLETED" })).mockResolvedValueOnce(Response.json({ ...summary, status: "CANCELLED", cancelledAt: "2026-09-10T12:00:00Z" }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/orders/order-api");
    await api.getOrder("token", summary.id); await api.completeOrder("token", summary.id); await api.cancelOrder("token", summary.id, { reason: "Solicitud del cliente" });
    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH", "POST"]);
    expect(requests[0].url).toContain(`/api/v1/orders/${summary.id}`);
    expect(await requests[1].json()).toEqual({ status: "COMPLETED" });
    expect(requests[2].url).toContain(`/api/v1/orders/${summary.id}/cancel`);
    expect(await requests[2].json()).toEqual({ reason: "Solicitud del cliente" });
  });
  it("maps active invoice conflicts without exposing backend messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ code: "ORDER_ACTIVE_INVOICE", message: "internal" }, { status: 409 })));
    const { cancelOrder } = await import("../src/features/orders/order-api");
    await expect(cancelOrder("token", summary.id, { reason: "Duplicada" })).rejects.toMatchObject({ code: "ORDER_ACTIVE_INVOICE", message: "Anula primero la factura activa antes de cancelar esta orden." });
  });
});
