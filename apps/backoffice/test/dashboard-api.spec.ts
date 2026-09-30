import { afterEach, describe, expect, it, vi } from "vitest";
const summary = { role: "ADMIN", updatedAt: "2026-09-30T12:00:00Z", lowStockThreshold: 5,
  metrics: { totalCustomers: 1, activeProducts: 2, lowStockProducts: 0, processingOrders: 3, pendingInvoices: 0 } };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe("dashboard REST boundary", () => {
  it("makes one authenticated cancellable aggregate request and validates the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(summary));
    vi.stubGlobal("fetch", fetchMock);
    const { getDashboardSummary } = await import("../src/features/dashboard/dashboard-api");
    const controller = new AbortController();
    expect(await getDashboardSummary("admin-token", "ADMIN", controller.signal)).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0][0] as Request;
    expect(request.url).toContain("/api/v1/dashboard/summary");
    expect(request.headers.get("Authorization")).toBe("Bearer admin-token");
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
  it.each([401, 403, 500])("maps %s errors without exposing server messages", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ message: "secret SQL" }, { status })));
    const { getDashboardSummary } = await import("../src/features/dashboard/dashboard-api");
    await expect(getDashboardSummary("token", "ADMIN")).rejects.toMatchObject({ status });
    await expect(getDashboardSummary("token", "ADMIN")).rejects.not.toMatchObject({ message: "secret SQL" });
  });
  it("rejects a response for another role even when structurally valid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(summary)));
    const { getDashboardSummary } = await import("../src/features/dashboard/dashboard-api");
    await expect(getDashboardSummary("token", "BILLING")).rejects.toMatchObject({ status: 502 });
  });
  it("rejects untrusted extra fields or malformed counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ...summary, metrics: { ...summary.metrics, activeProducts: -1 }, secrets: [] })));
    const { getDashboardSummary } = await import("../src/features/dashboard/dashboard-api");
    await expect(getDashboardSummary("token", "ADMIN")).rejects.toMatchObject({ status: 502 });
  });
});
