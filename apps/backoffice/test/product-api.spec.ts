import { afterEach, describe, expect, it, vi } from "vitest";

const product = {
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "CLP",
  deletedAt: null,
  description: "Teclado mecánico RGB",
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  image: { storageKey: "products/keyboard", url: "https://picsum.photos/id/96/800/600" },
  name: "Teclado Nova 75",
  price: "89990.00",
  sku: "KEY-NOVA-75",
  status: "ACTIVE" as const,
  updatedAt: "2026-09-04T12:00:00.000Z",
};

describe("product administration API client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses the generated REST contract for list, create, edit, status and soft-delete", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [{ ...product, stockAvailable: 8 }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 }))
      .mockResolvedValueOnce(Response.json(product, { status: 201 }))
      .mockResolvedValueOnce(Response.json(product))
      .mockResolvedValueOnce(Response.json({ ...product, status: "INACTIVE" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-api");
    const input = {
      currency: product.currency,
      description: product.description,
      image: product.image,
      name: product.name,
      price: product.price,
      sku: product.sku,
      status: product.status,
    };

    await api.listAdministrativeProducts("admin-token", 1);
    await api.createProduct("admin-token", input);
    await api.updateProduct("admin-token", product.id, { name: "Teclado Nova 75 Pro" });
    await api.updateProductStatus("admin-token", product.id, { status: "INACTIVE" });
    await api.deleteProduct("admin-token", product.id);

    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(requests.map((request) => request.method)).toEqual(["GET", "POST", "PATCH", "PATCH", "DELETE"]);
    expect(requests[0].url).toContain("/api/v1/products?page=1&pageSize=10&sortBy=createdAt&sortOrder=desc&view=administrative");
    expect(requests[1].url.endsWith("/api/v1/products")).toBe(true);
    expect(requests[2].url.endsWith(`/api/v1/products/${product.id}`)).toBe(true);
    expect(requests[3].url.endsWith(`/api/v1/products/${product.id}/status`)).toBe(true);
    expect(requests[4].url.endsWith(`/api/v1/products/${product.id}`)).toBe(true);
    for (const request of requests) expect(request.headers.get("Authorization")).toBe("Bearer admin-token");
  });
});
