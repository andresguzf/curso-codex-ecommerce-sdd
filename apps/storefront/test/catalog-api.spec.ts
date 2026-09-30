import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("public catalog REST client", () => {
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
