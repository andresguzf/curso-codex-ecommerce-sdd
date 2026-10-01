import { describe, expect, it } from "vitest";

import { catalogLandingQuerySchema, catalogLandingSchema } from "../src/catalog-landing";

const category = { id: "69bc283e-abbb-4557-87c4-dc614819bdba", name: "Computación", slug: "computacion", status: "ACTIVE" };
const product = {
  id: "685df2fb-1d91-48b1-9d6a-09612b16b8ba", sku: "DEMO", slug: "demo", name: "Notebook", description: "Notebook demo",
  price: "100.00", currency: "USD", status: "ACTIVE", stockAvailable: 0, category, tags: [],
  image: { storageKey: "demo", url: "/images/product-placeholder.svg" }, coverImage: null,
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
};
const composition = { featuredProducts: [product], latestProducts: [], highlightedCategories: [{ category, products: [product] }] };

describe("public landing boundary", () => {
  it("accepts empty and partial configurations and contextual category repetition", () => {
    expect(catalogLandingSchema.parse(composition)).toEqual(composition);
    expect(catalogLandingSchema.parse({ featuredProducts: [], latestProducts: [], highlightedCategories: [] })).toEqual({ featuredProducts: [], latestProducts: [], highlightedCategories: [] });
  });

  it("rejects administrative fields, inactive content and pagination metadata", () => {
    for (const extra of [{ isFeatured: true }, { featuredAt: "2026-10-01T00:00:00Z" }, { deletedAt: null }, { status: "INACTIVE" }, { currency: "EUR" }]) {
      expect(catalogLandingSchema.safeParse({ ...composition, featuredProducts: [{ ...product, ...extra }] }).success).toBe(false);
    }
    expect(catalogLandingSchema.safeParse({ ...composition, page: 1 }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, highlightedCategories: [{ category: { ...category, showOnLanding: true }, products: [product] }] }).success).toBe(false);
  });

  it("enforces limits and deduplication without forbidding contextual repetition", () => {
    const products = Array.from({ length: 10 }, (_, index) => ({ ...product, id: `685df2fb-1d91-48b1-9d6a-${String(index).padStart(12, "0")}` }));
    expect(catalogLandingSchema.safeParse({ ...composition, featuredProducts: products.slice(0, 4) }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, featuredProducts: [], latestProducts: products }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, latestProducts: [product] }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, highlightedCategories: [{ category, products: [] }] }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, highlightedCategories: [{ category, products: products.slice(0, 4) }] }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, highlightedCategories: Array(4).fill(composition.highlightedCategories[0]) }).success).toBe(false);
    expect(catalogLandingSchema.safeParse({ ...composition, highlightedCategories: [{ category, products: [{ ...product, category: null }] }] }).success).toBe(false);
  });

  it("accepts no query parameters", () => {
    expect(catalogLandingQuerySchema.parse({})).toEqual({});
    for (const name of ["page", "pageSize", "search", "categoryId", "tagIds", "view", "sortBy", "isFeatured"]) {
      expect(catalogLandingQuerySchema.safeParse({ [name]: "1" }).success).toBe(false);
    }
  });

  it("rejects inactive nested classifications and duplicate identities within sections", () => {
    for (const invalid of [
      { ...composition, featuredProducts: [], latestProducts: [{ ...product, status: "INACTIVE" }] },
      { ...composition, featuredProducts: [{ ...product, category: { ...category, status: "INACTIVE" } }] },
      { ...composition, featuredProducts: [{ ...product, tags: [{ ...category, status: "INACTIVE" }] }] },
      { ...composition, highlightedCategories: [{ category: { ...category, status: "INACTIVE" }, products: [product] }] },
      { ...composition, featuredProducts: [product, product] },
      { ...composition, highlightedCategories: [composition.highlightedCategories[0], composition.highlightedCategories[0]] },
      { ...composition, highlightedCategories: [{ category, products: [product, product] }] },
    ]) expect(catalogLandingSchema.safeParse(invalid).success).toBe(false);
  });
});
