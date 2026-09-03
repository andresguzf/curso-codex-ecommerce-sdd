import { describe, expect, it } from "vitest";

import {
  administrativeProductSchema,
  createProductRequestSchema,
  productDetailSchema,
  productListQuerySchema,
  productPageSchema,
  updateProductRequestSchema,
} from "../src/products";

const validProduct = {
  currency: "CLP",
  description: "A professional notebook",
  image: {
    storageKey: "products/notebook/cover.webp",
    url: "https://cdn.example.com/products/notebook/cover.webp",
  },
  name: "Notebook Pro",
  price: "1299990.00",
  sku: "NOTEBOOK-001",
};

describe("product HTTP schemas", () => {
  it("accepts fixed-precision product input and rejects stock or float values", () => {
    expect(createProductRequestSchema.safeParse(validProduct).success).toBe(true);
    expect(
      createProductRequestSchema.safeParse({ ...validProduct, price: 1299990 }),
    ).toMatchObject({ success: false });
    expect(
      createProductRequestSchema.safeParse({ ...validProduct, stock: 12 }),
    ).toMatchObject({ success: false });
  });

  it("requires a non-empty patch and validates administrative responses", () => {
    expect(updateProductRequestSchema.safeParse({}).success).toBe(false);
    expect(
      administrativeProductSchema.safeParse({
        ...validProduct,
        id: "8f732799-c098-45c1-961e-332c6becd13a",
        status: "INACTIVE",
        createdAt: "2026-09-03T12:00:00.000Z",
        updatedAt: "2026-09-03T12:00:00.000Z",
        deletedAt: null,
      }).success,
    ).toBe(true);
  });

  it("validates product list criteria, bounds and paginated responses", () => {
    expect(
      productListQuerySchema.parse({
        availability: "IN_STOCK",
        maxPrice: "2000000.00",
        minPrice: "1000000.00",
        page: "2",
        pageSize: "10",
        search: "notebook",
        sortBy: "price",
        sortOrder: "asc",
      }),
    ).toMatchObject({ page: 2, pageSize: 10, view: "public" });
    expect(
      productListQuerySchema.safeParse({ page: 0, pageSize: 101 }),
    ).toMatchObject({ success: false });
    expect(
      productListQuerySchema.safeParse({
        maxPrice: "10.00",
        minPrice: "20.00",
      }),
    ).toMatchObject({ success: false });
    expect(
      productPageSchema.safeParse({
        items: [
          {
            ...validProduct,
            id: "8f732799-c098-45c1-961e-332c6becd13a",
            status: "ACTIVE",
            stockAvailable: 3,
            createdAt: "2026-09-03T12:00:00.000Z",
            updatedAt: "2026-09-03T12:00:00.000Z",
          },
        ],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      }).success,
    ).toBe(true);
  });

  it("validates public detail availability without persistence metadata", () => {
    const detail = {
      ...validProduct,
      availability: "OUT_OF_STOCK",
      id: "8f732799-c098-45c1-961e-332c6becd13a",
      status: "ACTIVE",
      stockAvailable: 0,
      createdAt: "2026-09-03T12:00:00.000Z",
      updatedAt: "2026-09-03T12:00:00.000Z",
    };

    expect(productDetailSchema.safeParse(detail).success).toBe(true);
    expect(
      productDetailSchema.safeParse({ ...detail, availability: "UNKNOWN" }),
    ).toMatchObject({ success: false });
  });
});
