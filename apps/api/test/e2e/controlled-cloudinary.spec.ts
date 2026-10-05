import { ConfigService } from "@nestjs/config";
import { v2 } from "cloudinary";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { validateEnvironment, type EnvironmentVariables } from "../../src/config/environment.js";
import { CloudinaryImageStorage } from "../../src/product-catalog/image-storage/cloudinary-image-storage.js";
import { installControlledCloudinary } from "./controlled-cloudinary.js";

const original = { upload: v2.uploader.upload_stream, resource: v2.api.resource, delete: v2.api.delete_resources_by_asset_ids };
let bytes: Buffer;
beforeAll(async () => { bytes = await sharp({ create: { width: 8, height: 6, channels: 3, background: "navy" } }).png().toBuffer(); });
afterEach(() => { v2.uploader.upload_stream = original.upload; v2.api.resource = original.resource; v2.api.delete_resources_by_asset_ids = original.delete; });
function storage(mode: "dynamic" | "fixed" = "dynamic") {
  return new CloudinaryImageStorage(new ConfigService<EnvironmentVariables, true>(validateEnvironment({
    DATABASE_URL: "postgresql://unused:unused@localhost/unused", IMAGE_STORAGE_CATALOG_PROVIDER: "local",
    CLOUDINARY_CLOUD_NAME: "browser-test", CLOUDINARY_API_KEY: "controlled-key", CLOUDINARY_API_SECRET: "controlled-secret", CLOUDINARY_FOLDER_MODE: mode,
  })));
}
describe("browser-test SDK boundary is controlled and immutable", () => {
  it.each(["dynamic", "fixed"] as const)("confirms %s folder and decoded bytes without a real account", async (mode) => {
    const sdk = installControlledCloudinary();
    const asset = await storage(mode).upload({ data: bytes, mimeType: "image/png" });
    expect(sdk.stats().uploads).toEqual([{ publicId: expect.stringMatching(/^codex-storefront\/[a-f0-9-]+$/), folder: "codex-storefront", overwrite: false }]);
    expect(sdk.bytes(sdk.stats().assets[0]!.asset_id)).toEqual(bytes);
    expect(asset.storageKey).toMatch(/^cloudinary:v1:browser-test:/);
  });
  it("accepts one upload before timeout, recovers its identity and deletes only that asset", async () => {
    const sdk = installControlledCloudinary(); const provider = storage();
    sdk.control("timeout");
    const id = "e6404e48-9e90-438c-843c-3e8ff3ff8413";
    await expect(provider.upload({ data: bytes, mimeType: "image/png" }, id)).rejects.toMatchObject({ kind: "timeout" });
    const asset = await provider.findUpload(id);
    expect(asset).toBeDefined(); expect(sdk.stats().uploads).toHaveLength(1);
    expect(await provider.delete(asset!.storageKey)).toBe(true);
    // Missing managed resources are undefined, not null.
    expect(await provider.findUpload(id)).toBeUndefined();
    expect(await provider.delete(asset!.storageKey)).toBe(false);
    expect(sdk.stats().deleted).toHaveLength(1);
  });
  it("coordinates two uploads for the contention test without serializing remote calls", async () => {
    const sdk = installControlledCloudinary(); sdk.control("barrier");
    const provider = storage();
    const assets = await Promise.all([provider.upload({ data: bytes, mimeType: "image/png" }), provider.upload({ data: bytes, mimeType: "image/png" })]);
    expect(new Set(assets.map((asset) => asset.storageKey)).size).toBe(2);
    expect(sdk.stats().assets).toHaveLength(2);
  });
  it("does not accept bytes during a controlled outage or retry automatically", async () => {
    const sdk = installControlledCloudinary(); sdk.control("unavailable");
    await expect(storage().upload({ data: bytes, mimeType: "image/png" })).rejects.toMatchObject({ kind: "unavailable" });
    expect(sdk.stats().uploads).toHaveLength(1); expect(sdk.stats().assets).toHaveLength(0);
  });
});
