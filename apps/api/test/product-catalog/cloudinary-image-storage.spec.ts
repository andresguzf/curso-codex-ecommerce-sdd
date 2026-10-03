import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { type EnvironmentVariables, validateEnvironment } from "../../src/config/environment";
import { catalogAssetProvider, cloudinaryAssetKey, parseCloudinaryAssetKey } from "../../src/product-catalog/image-storage/catalog-asset-key";
import { CatalogImageStorageRouter } from "../../src/product-catalog/image-storage/catalog-image-storage-router";
import { CATALOG_ASSET_TAG, CloudinaryImageStorage, CloudinaryStorageError } from "../../src/product-catalog/image-storage/cloudinary-image-storage";
import type { CloudinaryTransport } from "../../src/product-catalog/image-storage/cloudinary-sdk.transport";
import { ImageStorage, ImageStorageNotFoundError } from "../../src/product-catalog/image-storage/image-storage.port";

const uploadId = "b12bb32a-b99a-44ab-8e70-32d6c2cba001";
const assetId = "a".repeat(32);
const publicId = `codex-storefront/${uploadId}`;
const key = `cloudinary:v1:test-cloud:${uploadId}:${assetId}`;
let png: Buffer;

function config(mode: "dynamic" | "fixed" = "dynamic", overrides: Record<string, unknown> = {}) {
  return new ConfigService<EnvironmentVariables, true>(validateEnvironment({
    DATABASE_URL: "postgresql://test:test@localhost/test",
    IMAGE_STORAGE_CATALOG_PROVIDER: "local",
    CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key-only",
    CLOUDINARY_API_SECRET: "test-secret-only", CLOUDINARY_FOLDER_MODE: mode,
    ...overrides,
  }));
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    asset_id: assetId, public_id: publicId, resource_type: "image", type: "upload",
    secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.png`,
    format: "png", bytes: png.length, width: 32, height: 16,
    asset_folder: "codex-storefront", tags: [CATALOG_ASSET_TAG], ...overrides,
  };
}

function transport() {
  return {
    upload: vi.fn<CloudinaryTransport["upload"]>().mockImplementation(async (_bytes, options) => {
      const id = options.folder ? `codex-storefront/${options.public_id}` : options.public_id;
      return response({ public_id: id, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${id}.png` });
    }),
    resource: vi.fn<CloudinaryTransport["resource"]>().mockImplementation(async () => response()),
    deleteAsset: vi.fn<CloudinaryTransport["deleteAsset"]>().mockResolvedValue({ deleted: { [assetId]: "deleted" } }),
    readBytes: vi.fn<CloudinaryTransport["readBytes"]>().mockImplementation(async () => png),
  };
}

beforeAll(async () => {
  png = await sharp({ create: { width: 32, height: 16, channels: 3, background: "#123456" } }).png().toBuffer();
});
afterEach(() => vi.useRealTimers());

describe("Cloudinary catalog adapter (controlled transport, no real credentials)", () => {
  it.each(["dynamic", "fixed"] as const)("uploads immutable identities to the %s folder", async (mode) => {
    const sdk = transport();
    const stored = await new CloudinaryImageStorage(config(mode), sdk).upload({ data: png, mimeType: "image/png" }, uploadId);
    const options = sdk.upload.mock.calls[0]![1];
    expect(options).toMatchObject({ overwrite: false, resource_type: "image", type: "upload", use_filename: false, unique_filename: false, tags: [CATALOG_ASSET_TAG] });
    if (mode === "dynamic") {
      expect(options).toMatchObject({ asset_folder: "codex-storefront", public_id: publicId });
      expect(options.folder).toBeUndefined();
    } else {
      expect(options).toMatchObject({ folder: "codex-storefront", public_id: uploadId });
      expect(options.asset_folder).toBeUndefined();
    }
    expect(stored).toEqual({ storageKey: key, url: response().secure_url, mimeType: "image/png", size: png.length });
    expect(JSON.stringify(stored)).not.toContain("test-secret-only");
  });

  it("uses new identities for separate uploads", async () => {
    const sdk = transport();
    const storage = new CloudinaryImageStorage(config(), sdk);
    const first = await storage.upload({ data: png, mimeType: "image/png" });
    const second = await storage.upload({ data: png, mimeType: "image/png" });
    expect(first.storageKey).not.toBe(second.storageKey);
    expect(parseCloudinaryAssetKey(first.storageKey).publicId).toMatch(/^codex-storefront\//);
  });

  it.each(["jpeg", "webp"] as const)("accepts decoded %s bytes without converting format", async (format) => {
    const data = await sharp(png).toFormat(format).toBuffer();
    const extension = format === "jpeg" ? "jpg" : format;
    const sdk = transport();
    sdk.upload.mockResolvedValue(response({ format: extension, bytes: data.length, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.${extension}` }));
    const result = await new CloudinaryImageStorage(config(), sdk).upload({ data, mimeType: `image/${format}` }, uploadId);
    expect(result.mimeType).toBe(`image/${format}`);
    expect(sdk.upload.mock.calls[0]![0]).toEqual(data);
  });

  it.each([
    ["empty", Buffer.alloc(0), "image/png", "IMAGE_EMPTY"],
    ["unsupported", Buffer.from("not an image"), "image/png", "IMAGE_UNSUPPORTED_TYPE"],
    ["spoofed", "png", "image/jpeg", "IMAGE_MIME_MISMATCH"],
    ["truncated", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png", "IMAGE_UNSUPPORTED_TYPE"],
    ["oversized", Buffer.alloc(2048), "image/png", "IMAGE_TOO_LARGE"],
  ])("rejects %s files before upload", async (_label, bytes, mimeType, code) => {
    const sdk = transport();
    const storage = new CloudinaryImageStorage(config("dynamic", { IMAGE_STORAGE_MAX_BYTES: 1024 }), sdk);
    await expect(storage.upload({ data: bytes === "png" ? png : bytes as Buffer, mimeType: mimeType as string })).rejects.toMatchObject({ code });
    expect(sdk.upload).not.toHaveBeenCalled();
  });

  it.each([
    { resource_type: "video" }, { type: "private" }, { asset_id: "invalid" },
    { public_id: "elsewhere/file" }, { asset_folder: "other" }, { tags: [] },
    { secure_url: "http://res.cloudinary.com/test-cloud/image/upload/v123/file.png" },
    { secure_url: "https://attacker.example/image.png" },
    { secure_url: `https://res.cloudinary.com/other-cloud/image/upload/v123/${publicId}.png` },
    { secure_url: `${responseUrl()}?token=private` },
    { width: 0 }, { width: 99 }, { bytes: 1 }, { format: "gif" },
  ])("rejects invalid upstream metadata %j", async (override) => {
    const sdk = transport();
    sdk.upload.mockResolvedValue(response(override));
    await expect(new CloudinaryImageStorage(config(), sdk).upload({ data: png, mimeType: "image/png" }, uploadId)).rejects.toMatchObject({ kind: "upstream", uploadId });
  });

  it("does not write a local copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "cloudinary-adapter-test-"));
    try {
      await new CloudinaryImageStorage(config("dynamic", { IMAGE_STORAGE_LOCAL_ROOT: root }), transport()).upload({ data: png, mimeType: "image/png" }, uploadId);
      expect(await readdir(root)).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it("redacts SDK errors and retains the upload identity", async () => {
    const sdk = transport();
    sdk.upload.mockRejectedValue({ message: "test-secret-only leaked by provider", http_code: 500 });
    await expect(new CloudinaryImageStorage(config(), sdk).upload({ data: png, mimeType: "image/png" }, uploadId)).rejects.toMatchObject({ message: "Image storage is unavailable", kind: "unavailable", uploadId });
    expect(sdk.upload).toHaveBeenCalledTimes(1);
  });

  it("bounds waiting without reuploading uncertain results", async () => {
    const sdk = transport();
    // Let decoding finish before enabling fake timers.
    sdk.upload.mockImplementation(() => { vi.useFakeTimers(); return new Promise(() => undefined); });
    const promise = new CloudinaryImageStorage(config(), sdk).upload({ data: png, mimeType: "image/png" }, uploadId);
    const assertion = expect(promise).rejects.toMatchObject({ kind: "timeout", uploadId });
    await vi.waitFor(() => expect(sdk.upload).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  });

  it("reads only verified managed delivery URLs", async () => {
    const sdk = transport();
    const result = await new CloudinaryImageStorage(config(), sdk).read(key);
    expect(result.data).toEqual(png);
    expect(sdk.readBytes).toHaveBeenCalledWith(response().secure_url, 5242880);
  });

  it("deletes by stable asset ID only after checking ownership", async () => {
    const sdk = transport();
    expect(await new CloudinaryImageStorage(config(), sdk).delete(key)).toBe(true);
    expect(sdk.resource).toHaveBeenCalledWith(publicId);
    expect(sdk.deleteAsset).toHaveBeenCalledWith(assetId);
    sdk.resource.mockResolvedValue(response({ asset_id: "b".repeat(32) }));
    sdk.deleteAsset.mockClear();
    await expect(new CloudinaryImageStorage(config(), sdk).delete(key)).rejects.toBeInstanceOf(CloudinaryStorageError);
    expect(sdk.deleteAsset).not.toHaveBeenCalled();
  });

  it("accepts the documented deletion response keyed by public ID", async () => {
    const sdk = transport();
    sdk.deleteAsset.mockResolvedValue({ deleted: { [publicId]: "deleted" }, partial: false });
    expect(await new CloudinaryImageStorage(config(), sdk).delete(key)).toBe(true);
    sdk.deleteAsset.mockResolvedValue({ deleted: { unrelated: "deleted" } });
    await expect(new CloudinaryImageStorage(config(), sdk).delete(key)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("treats missing managed assets as absent", async () => {
    const sdk = transport();
    sdk.resource.mockRejectedValue({ error: { http_code: 404 } });
    const storage = new CloudinaryImageStorage(config(), sdk);
    expect(await storage.delete(key)).toBe(false);
    await expect(storage.read(key)).rejects.toBeInstanceOf(ImageStorageNotFoundError);
    expect(sdk.deleteAsset).not.toHaveBeenCalled();
  });

  it("rejects external, malformed and other-cloud keys before contacting the SDK", async () => {
    const sdk = transport();
    const storage = new CloudinaryImageStorage(config(), sdk);
    for (const candidate of ["products/demo/cover.webp", "https://picsum.photos/1", "../logo.png", key.replace("test-cloud", "another-cloud"), "cloudinary:v1:invalid"]) {
      await expect(storage.delete(candidate)).rejects.toMatchObject({ code: "IMAGE_INVALID_KEY" });
    }
    expect(sdk.resource).not.toHaveBeenCalled();
    expect(sdk.deleteAsset).not.toHaveBeenCalled();
  });
});

function responseUrl() { return `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.png`; }

describe("provider routing is per asset, not per current upload setting", () => {
  it("preserves local keys and treats demo references as external", () => {
    expect(catalogAssetProvider(`${uploadId}.png`)).toBe("local");
    expect(catalogAssetProvider(key)).toBe("cloudinary");
    expect(catalogAssetProvider("products/demo/cover.webp")).toBe("external");
    expect(parseCloudinaryAssetKey(key)).toEqual({ cloudName: "test-cloud", uploadId, assetId, publicId });
    expect(cloudinaryAssetKey(parseCloudinaryAssetKey(key))).toBe(key);
  });

  it.each(["local", "cloudinary"] as const)("routes old assets correctly with %s uploads", async (provider) => {
    const local = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as ImageStorage;
    const cloud = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as ImageStorage;
    const router = new CatalogImageStorageRouter(local, cloud, provider);
    await router.upload({ data: png, mimeType: "image/png" });
    expect(provider === "local" ? local.upload : cloud.upload).toHaveBeenCalledOnce();
    await router.read(`${uploadId}.png`);
    await router.delete(key);
    expect(local.read).toHaveBeenCalledWith(`${uploadId}.png`);
    expect(cloud.delete).toHaveBeenCalledWith(key);
    expect(() => router.delete("products/demo/cover.webp")).toThrow("External images");
  });

  it("never falls back to local when Cloudinary is missing", () => {
    const local = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as ImageStorage;
    const router = new CatalogImageStorageRouter(local, undefined, "cloudinary");
    expect(() => router.upload({ data: png, mimeType: "image/png" })).toThrow("Cloudinary configuration");
    expect(() => router.delete(key)).toThrow("Cloudinary configuration");
    expect(local.upload).not.toHaveBeenCalled();
    expect(local.delete).not.toHaveBeenCalled();
  });
});
