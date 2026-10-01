import { describe, expect, it } from "vitest";
import { productGalleryImageSchema, updateProductImageRequestSchema } from "../src/product-images";

describe("product image HTTP schemas", () => {
  it("validates complete image responses including legacy unknown dimensions", () => {
    const image = { id: "762ae854-d19c-4d47-84e9-7f1a4a667e14", productId: "49c76d8d-a6c9-4a37-8e41-96cf61ac91dc", storageKey: "legacy/image", url: "/images/product-placeholder.svg", altText: "Teclado", isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" };
    expect(productGalleryImageSchema.safeParse(image).success).toBe(true);
    for (const patch of [{ sortOrder: -1 }, { width: 0 }, { altText: "" }, { isPrimary: "true" }]) expect(productGalleryImageSchema.safeParse({ ...image, ...patch }).success).toBe(false);
  });
  it("allows only non-empty edits of alt text, cover or position", () => {
    expect(updateProductImageRequestSchema.parse({ altText: "  Teclado  ", isPrimary: true, sortOrder: 0 })).toEqual({ altText: "Teclado", isPrimary: true, sortOrder: 0 });
    for (const patch of [{}, { altText: " " }, { sortOrder: 1.2 }, { sortOrder: -1 }, { url: "https://example.com" }, { isPrimary: "false" }]) expect(updateProductImageRequestSchema.safeParse(patch).success).toBe(false);
  });
});
