import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("public catalog REST client", () => {
  it("loads the fixed landing composition in one request without criteria or pagination", async () => {
    const body = { featuredProducts: [], latestProducts: [], highlightedCategories: [] };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
    vi.stubGlobal("fetch", fetchMock);
    const { getCatalogLanding } = await import("../src/features/catalog/catalog-api");
    const controller = new AbortController();
    expect(await getCatalogLanding(controller.signal)).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe("/api/v1/catalog/landing");
    expect(new URL(request.url).search).toBe("");
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });

  it("rejects invalid, inactive or duplicated landing content and unsafe API errors", async () => {
    const product = {
      id: "10184fd0-3dcb-47cf-af70-a8be4c765421", sku: "DEMO", slug: "demo", name: "Demo", description: "Demo",
      price: "100.00", currency: "USD", image: { storageKey: "demo", url: "/images/product-placeholder.svg" },
      coverImage: null, status: "ACTIVE", stockAvailable: 0, category: null, tags: [],
      createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
    };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getCatalogLanding } = await import("../src/features/catalog/catalog-api");
    for (const body of [
      { featuredProducts: [], latestProducts: [{ ...product, status: "INACTIVE" }], highlightedCategories: [] },
      { featuredProducts: [product], latestProducts: [product], highlightedCategories: [] },
      { featuredProducts: [], latestProducts: Array(10).fill(product), highlightedCategories: [] },
      { items: [], page: 1 },
    ]) {
      fetchMock.mockResolvedValueOnce(Response.json(body));
      await expect(getCatalogLanding()).rejects.toThrow();
    }
    fetchMock.mockResolvedValueOnce(Response.json({ message: "Internal database details" }, { status: 500 }));
    await expect(getCatalogLanding()).rejects.toThrow("No fue posible cargar las novedades.");
  });
  it("requests one filtered backend page instead of downloading the whole catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      items: [],
      page: 3,
      pageSize: 12,
      totalItems: 25,
      totalPages: 3,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { getPublicProducts } = await import("../src/features/catalog/catalog-api");

    const response = await getPublicProducts({
      availability: "IN_STOCK",
      categoryId: "553c237f-d1a5-4e98-b7c5-e67415724cf2",
      tagIds: ["16875593-f79f-45fd-b642-fc4e13154519"],
      maxPrice: "300",
      minPrice: "100",
      page: 3,
      search: "teclado",
      sortBy: "price",
      sortOrder: "asc",
    }, 12);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    const url = new URL(request.url);
    expect(url.pathname).toBe("/api/v1/products");
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("pageSize")).toBe("12");
    expect(url.searchParams.get("search")).toBe("teclado");
    expect(url.searchParams.get("availability")).toBe("IN_STOCK");
    expect(url.searchParams.get("categoryId")).toBe("553c237f-d1a5-4e98-b7c5-e67415724cf2");
    expect(url.searchParams.get("minPrice")).toBe("100");
    expect(url.searchParams.get("maxPrice")).toBe("300");
    expect(url.searchParams.get("sortBy")).toBe("price");
    expect(url.searchParams.get("sortOrder")).toBe("asc");
    expect(response).toMatchObject({
      items: [],
      page: 3,
      pageSize: 12,
      totalItems: 25,
      totalPages: 3,
    });
  });
});
