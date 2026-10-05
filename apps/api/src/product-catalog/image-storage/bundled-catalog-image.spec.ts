import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { BUNDLED_CATALOG_KEY, BUNDLED_CATALOG_SHA256, deliveredCatalogImage } from "./bundled-catalog-image.js";
import { LocalImageStorage } from "./local-image-storage.js";
import type { EnvironmentVariables } from "../../config/environment.js";

describe("authorized read-only catalog asset", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("reads identical bytes without mutable local storage, including after reinvocation", async () => {
    const config = new ConfigService({ IMAGE_STORAGE_LOCAL_ROOT: "/nonexistent-read-only-storage", IMAGE_STORAGE_MAX_BYTES: 4194304,
      IMAGE_STORAGE_PUBLIC_BASE_URL: "https://api.example.com/api/v1/media/images" }) as ConfigService<EnvironmentVariables, true>;
    for (let instance = 0; instance < 2; instance++) {
      const content = await new LocalImageStorage(config).read(BUNDLED_CATALOG_KEY);
      expect(content.mimeType).toBe("image/png");
      expect(createHash("sha256").update(content.data).digest("hex")).toBe(BUNDLED_CATALOG_SHA256);
    }
  });
  it("rewrites only the approved localhost reference, never persistence or external assets", () => {
    vi.stubEnv("VERCEL", "1");
    const image = { storageKey: BUNDLED_CATALOG_KEY, url: `http://localhost:3001/api/v1/media/images/${BUNDLED_CATALOG_KEY}`, altText: "Smartphone" };
    expect(deliveredCatalogImage(image)).toEqual({ ...image, url: `/api/v1/media/images/${BUNDLED_CATALOG_KEY}` });
    expect(image.url).toContain("localhost");
    const external = { ...image, url: "https://picsum.photos/id/1/800/600" };
    expect(deliveredCatalogImage(external)).toBe(external);
    expect(deliveredCatalogImage({ ...image, storageKey: "unapproved.png" }).url).toBe(image.url);
  });
});
