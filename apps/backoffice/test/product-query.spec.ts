import { describe, expect, it } from "vitest";

import { parseProductAdminFilters, productAdminFiltersToParams } from "../src/features/products/product-query";

const categoryId = "8f732799-c098-45c1-961e-332c6becd13a";
const firstTagId = "62ac275e-bbf6-43ab-8885-e5588bd24c87";
const secondTagId = "1ac275e0-bbf6-43ab-8885-e5588bd24c87";

describe("product admin filters", () => {
  it("parses and serializes price, category, multiple tags and inclusive creation-date criteria", () => {
    const filters = parseProductAdminFilters(new URLSearchParams(
      `page=4&pageSize=20&minPrice=50.00&maxPrice=100&categoryId=${categoryId}&tagIds=${firstTagId},${secondTagId}&createdFrom=2026-09-01&createdTo=2026-09-30`,
    ));

    expect(filters).toEqual({
      categoryId,
      createdFrom: "2026-09-01",
      createdTo: "2026-09-30",
      maxPrice: "100",
      minPrice: "50.00",
      page: 4,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
      tagIds: [firstTagId, secondTagId],
    });
    expect(productAdminFiltersToParams(filters).toString()).toBe(
      `page=4&pageSize=20&minPrice=50.00&maxPrice=100&categoryId=${categoryId}&tagIds=${firstTagId}%2C${secondTagId}&createdFrom=2026-09-01&createdTo=2026-09-30`,
    );
  });

  it("ignores malformed identifiers, prices, dates and reversed ranges from edited URLs", () => {
    const filters = parseProductAdminFilters(new URLSearchParams(
      "minPrice=abc&maxPrice=10&categoryId=invalid&tagIds=invalid&createdFrom=2026-09-30&createdTo=2026-09-01",
    ));

    expect(filters).toEqual({ maxPrice: "10", page: 1, pageSize: 10, sortBy: "createdAt", sortOrder: "desc" });
  });
});
