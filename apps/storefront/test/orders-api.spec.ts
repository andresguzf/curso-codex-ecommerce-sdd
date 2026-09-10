import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("orders REST client", () => {
  it("uses the customer history with bearer, server pagination, filter and no browser cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ items: [], page: 3, pageSize: 20, totalItems: 0, totalPages: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getMyOrders } = await import("../src/features/orders/orders-api");
    await getMyOrders("token", { page: 3, pageSize: 20, status: "CANCELLED" });
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/v1/orders/mine?page=3&pageSize=20&status=CANCELLED");
    expect(request.headers.get("Authorization")).toBe("Bearer token");
    expect(request.cache).toBe("no-store");
  });
  it("uses operational order detail, not checkout confirmation, and hides server messages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: "secret owner" }, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getMyOrder } = await import("../src/features/orders/orders-api");
    await expect(getMyOrder("token", "foreign-id")).rejects.toMatchObject({ status: 404, message: "No encontramos esta compra en tu cuenta." });
    expect((fetchMock.mock.calls[0][0] as Request).url).toContain("/api/v1/orders/foreign-id");
  });
  it("rejects malformed success responses instead of rendering unchecked data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ items: "invalid" })));
    const { getMyOrders } = await import("../src/features/orders/orders-api");
    await expect(getMyOrders("token", { page: 1, pageSize: 20 })).rejects.toThrow();
  });
});
