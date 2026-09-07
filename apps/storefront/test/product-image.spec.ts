import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRODUCT_IMAGE_URL,
  resolveProductImageUrl,
} from "../src/features/catalog/product-image-url";

describe("product image resolver", () => {
  it("uses the local placeholder for empty, malformed or unconfigured sources", () => {
    expect(resolveProductImageUrl(undefined)).toBe(DEFAULT_PRODUCT_IMAGE_URL);
    expect(resolveProductImageUrl(" ")).toBe(DEFAULT_PRODUCT_IMAGE_URL);
    expect(resolveProductImageUrl("http://imshrnfdjg")).toBe(DEFAULT_PRODUCT_IMAGE_URL);
    expect(resolveProductImageUrl("https://example.com/product.webp")).toBe(
      DEFAULT_PRODUCT_IMAGE_URL,
    );
  });

  it("keeps local paths and configured image providers", () => {
    expect(resolveProductImageUrl("/images/product-placeholder.svg")).toBe(
      DEFAULT_PRODUCT_IMAGE_URL,
    );
    expect(resolveProductImageUrl("https://picsum.photos/id/60/1200/900.webp")).toBe(
      "https://picsum.photos/id/60/1200/900.webp",
    );
    expect(
      resolveProductImageUrl("http://localhost:3001/api/v1/media/images/cover.webp"),
    ).toBe("http://localhost:3001/api/v1/media/images/cover.webp");
  });
});
