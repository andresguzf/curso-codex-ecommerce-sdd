import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Only this historical asset was authorized for immutable deployment delivery.
export const BUNDLED_CATALOG_KEY = "a1bad9a3-59e8-491c-a0cd-ffa76c3ec8ef.png";
export const BUNDLED_CATALOG_SHA256 = "b9d0f53fc42fa0a81b27259c832a1b23a0d81ebf5e68f5d8b4d1e2d736525a85";

export async function readBundledCatalogImage(key: string): Promise<Buffer | undefined> {
  if (key !== BUNDLED_CATALOG_KEY) return undefined;
  const data = await readFile(new URL(
    "./bundled-assets/a1bad9a3-59e8-491c-a0cd-ffa76c3ec8ef.png", import.meta.url,
  ));
  if (createHash("sha256").update(data).digest("hex") !== BUNDLED_CATALOG_SHA256) {
    throw new Error("Bundled catalog image integrity check failed");
  }
  return data;
}

export function deliveredCatalogImage<T extends Readonly<{ storageKey: string; url: string }>>(image: T): T {
  if (process.env.VERCEL !== "1" || image.storageKey !== BUNDLED_CATALOG_KEY
    || image.url !== `http://localhost:3001/api/v1/media/images/${BUNDLED_CATALOG_KEY}`) return image;
  // Same-origin REST rewrite in both frontends; persistence is never rewritten.
  return { ...image, url: `/api/v1/media/images/${BUNDLED_CATALOG_KEY}` };
}
