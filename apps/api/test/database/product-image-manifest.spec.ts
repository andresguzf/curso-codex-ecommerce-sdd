import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDevelopmentProductImageManifest } from "../../src/database/seed/product-image-manifest";

describe("development product image manifest", () => {
  it("defines twenty stable product associations and sixty ordered images with exactly one cover per product", () => {
    const products = getDevelopmentProductImageManifest("test");
    expect(products).toHaveLength(20);
    expect(new Set(products.map((product) => product.sku)).size).toBe(20);
    const images = products.flatMap((product) => product.images);
    expect(images).toHaveLength(60);
    expect(new Set(images.map((image) => image.storageKey)).size).toBe(60);
    expect(new Set(images.map((image) => image.cloudinaryPublicId)).size).toBe(60);
    for (const product of products) {
      expect(product.images.map((image) => image.sortOrder)).toEqual([0, 1, 2]);
      expect(product.images.filter((image) => image.isPrimary)).toHaveLength(1);
      expect(product.images[0]?.isPrimary).toBe(true);
      expect(new Set(product.images.map((image) => image.picsumId)).size).toBe(3);
      for (const image of product.images) {
        expect(image.url).toBe(`https://picsum.photos/id/${image.picsumId}/1200/900.webp`);
        expect(image).toMatchObject({ width: 1200, height: 900, mimeType: "image/webp", format: "webp" });
        expect(image.storageKey).toContain(product.sku.toLowerCase());
        expect(image.cloudinaryPublicId).toMatch(/^technology-ecommerce\/products\/dev-[a-z]+-\d{3}\/(cover|gallery-[12])$/);
        expect(image.altText).toContain(product.name);
        expect(image.altText).toContain(image.review.description);
        expect(image.review).toMatchObject({ date: "2026-10-01", fidelity: "illustration-not-exact-model" });
      }
    }
  });

  it("preserves the three existing seed SKU identities and deterministic immutable output", () => {
    const first = getDevelopmentProductImageManifest("development");
    expect(first).toEqual(getDevelopmentProductImageManifest("test"));
    expect(first.map((product) => product.sku)).toEqual(expect.arrayContaining(["DEV-LAPTOP-001", "DEV-MONITOR-001", "DEV-KEYBOARD-001"]));
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first[0]?.images)).toBe(true);
    expect(Object.isFrozen(first[0]?.images[0])).toBe(true);
  });

  it.each(["production", "staging", "", undefined, null, "Development"])("rejects forbidden or unknown environment %s", (environment) => {
    expect(() => getDevelopmentProductImageManifest(environment)).toThrow("restricted to development and test");
  });

  it("uses reviewed technology scenes and appropriate cover subjects, not random landscapes", () => {
    const coverIds = { laptop: new Set([0, 2, 6, 8, 9, 48]), monitor: new Set([60]), keyboard: new Set([60]), phone: new Set([3, 26, 42]) };
    for (const product of getDevelopmentProductImageManifest("test")) expect(coverIds[product.kind].has(product.images[0]!.picsumId)).toBe(true);
  });

  it("references an existing storefront fallback without a remote dependency", async () => {
    await access(resolve("../storefront/public/images/product-placeholder.svg"));
    for (const product of getDevelopmentProductImageManifest("test")) for (const image of product.images) {
      expect(image.fallback.url).toBe("/images/product-placeholder.svg");
      expect(image.fallback.altText).toContain(product.name);
    }
  });
});
