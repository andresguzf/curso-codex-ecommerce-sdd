import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { type EnvironmentVariables, validateEnvironment } from "../../src/config/environment.js";
import { StoreLogoService } from "../../src/billing-invoicing/store-logo.service.js";
import { DocumentExportService } from "../../src/document-export/document-export.service.js";
import { CatalogImageStorageService, createCatalogImageStorageService } from "../../src/product-catalog/image-storage/catalog-image-storage.service.js";
import { ImageReferenceLookup } from "../../src/product-catalog/image-storage/image-reference.repository.js";
import { ImageStorageModule } from "../../src/product-catalog/image-storage/image-storage.module.js";
import { ImageStorage } from "../../src/product-catalog/image-storage/image-storage.port.js";
import { ImageStorageService } from "../../src/product-catalog/image-storage/image-storage.service.js";
import { LocalImageStorage } from "../../src/product-catalog/image-storage/local-image-storage.js";
import { CloudinarySdkTransport } from "../../src/product-catalog/image-storage/cloudinary-sdk.transport.js";
import { CATALOG_ASSET_TAG } from "../../src/product-catalog/image-storage/cloudinary-image-storage.js";
import { afterEach } from "vitest";
import sharp from "sharp";
import { ProductImagesService } from "../../src/product-catalog/product-images.service.js";

const references = { isReferenced: vi.fn().mockResolvedValue(false) } as unknown as ImageReferenceLookup;
const local = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as LocalImageStorage;

describe("catalog storage preparation", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.clearAllMocks(); });

  it("reconstructs local/cloud factories without migrating existing assets and routes by origin", async () => {
    const bytes = await sharp({ create: { width: 4, height: 3, channels: 3, background: "navy" } }).png().toBuffer();
    const id = "f8c6ad19-ff10-4231-88fc-6f28897d6418";
    const localKey = `${id}.png`;
    const cloudKey = `cloudinary:v1:test-cloud:${id}:${"a".repeat(32)}`;
    const asset = (publicId: string) => ({ public_id: publicId, asset_id: "a".repeat(32), resource_type: "image", type: "upload",
      asset_folder: "codex-storefront", tags: [CATALOG_ASSET_TAG], format: "png", width: 4, height: 3, bytes: bytes.length,
      secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v123/${publicId}.png` });
    const upload = vi.spyOn(CloudinarySdkTransport.prototype, "upload").mockImplementation(async (_data, options) => asset(String(options.public_id)));
    const resource = vi.spyOn(CloudinarySdkTransport.prototype, "resource").mockImplementation(async (publicId) => asset(publicId));
    const readBytes = vi.spyOn(CloudinarySdkTransport.prototype, "readBytes").mockResolvedValue(bytes);
    const remove = vi.spyOn(CloudinarySdkTransport.prototype, "deleteAsset").mockResolvedValue({ deleted: { ["a".repeat(32)]: "deleted" } });
    const fakeLocal = { upload: vi.fn().mockResolvedValue({ storageKey: localKey }), read: vi.fn().mockResolvedValue({ storageKey: localKey, data: bytes }), delete: vi.fn().mockResolvedValue(true) } as unknown as LocalImageStorage;
    for (const provider of ["cloudinary", "local", "cloudinary"] as const) {
      const config = new ConfigService<EnvironmentVariables, true>(validateEnvironment({ DATABASE_URL: "postgresql://test:test@localhost/test",
        IMAGE_STORAGE_CATALOG_PROVIDER: provider, CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key",
        CLOUDINARY_API_SECRET: "test-secret", CLOUDINARY_FOLDER_MODE: "dynamic" }));
      const counts = [upload.mock.calls.length, resource.mock.calls.length, readBytes.mock.calls.length, remove.mock.calls.length];
      const catalog = createCatalogImageStorageService(config, fakeLocal, references);
      expect([upload.mock.calls.length, resource.mock.calls.length, readBytes.mock.calls.length, remove.mock.calls.length]).toEqual(counts);
      expect((await catalog.read(localKey)).data).toEqual(bytes);
      expect((await catalog.read(cloudKey)).data).toEqual(bytes);
      const uploaded = await catalog.upload({ data: bytes, mimeType: "image/png" });
      expect(uploaded.storageKey.startsWith("cloudinary:")).toBe(provider === "cloudinary");
      await catalog.deleteIfUnreferenced(localKey);
      await catalog.deleteIfUnreferenced(cloudKey);
    }
    expect(upload).toHaveBeenCalledTimes(2);
    expect(fakeLocal.upload).toHaveBeenCalledOnce();
    expect(fakeLocal.delete).toHaveBeenCalledTimes(3);
    expect(remove).toHaveBeenCalledTimes(3);
  });

  it("does not rewrite cloud references or fallback when their credentials are removed", async () => {
    const config = new ConfigService<EnvironmentVariables, true>(validateEnvironment({ DATABASE_URL: "postgresql://test:test@localhost/test" }));
    const fakeLocal = { upload: vi.fn(), read: vi.fn(), delete: vi.fn() } as unknown as LocalImageStorage;
    const catalog = createCatalogImageStorageService(config, fakeLocal, references);
    const id = "f8c6ad19-ff10-4231-88fc-6f28897d6418";
    const key = `cloudinary:v1:test-cloud:${id}:${"a".repeat(32)}`;
    expect(() => catalog.read(key)).toThrow("Cloudinary configuration is required");
    await expect(catalog.deleteIfUnreferenced(key)).rejects.toThrow("Cloudinary configuration is required");
    expect(fakeLocal.read).not.toHaveBeenCalled();
    expect(fakeLocal.delete).not.toHaveBeenCalled();
    await catalog.read(`${id}.png`);
    expect(fakeLocal.read).toHaveBeenCalledWith(`${id}.png`);
  });
  it("uses a distinct service token and delegates local uploads without contacting Cloudinary", async () => {
    const config = new ConfigService<EnvironmentVariables, true>(validateEnvironment({
      DATABASE_URL: "postgresql://test:test@localhost/test",
      CLOUDINARY_API_SECRET: "test-only-not-real",
    }));
    const catalog = createCatalogImageStorageService(config, local, references);
    const enterprise = new ImageStorageService(local, references);
    expect(catalog).toBeInstanceOf(CatalogImageStorageService);
    expect(catalog).not.toBe(enterprise);
    const input = { data: Buffer.from("test"), mimeType: "image/png" };
    await catalog.upload(input);
    expect(local.upload).toHaveBeenCalledWith(input);
    await enterprise.read("historical-logo.png");
    expect(local.read).toHaveBeenCalledWith("historical-logo.png");
  });

  it("selects the configured cloud adapter without falling back to local", () => {
    const config = new ConfigService<EnvironmentVariables, true>(validateEnvironment({
      DATABASE_URL: "postgresql://test:test@localhost/test",
      IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key",
      CLOUDINARY_API_SECRET: "test-secret", CLOUDINARY_FOLDER_MODE: "dynamic",
    }));
    const upload = vi.spyOn(local, "upload");
    upload.mockClear();
    expect(createCatalogImageStorageService(config, local, references)).toBeInstanceOf(CatalogImageStorageService);
    expect(upload).not.toHaveBeenCalled();
  });

  it("pins enterprise storage to local and injects the catalog token only into product mutations", () => {
    const providers = Reflect.getMetadata("providers", ImageStorageModule) as unknown[];
    expect(providers).toContainEqual({ provide: ImageStorage, useExisting: LocalImageStorage });
    expect(providers).toContainEqual({
      provide: CatalogImageStorageService, useFactory: createCatalogImageStorageService,
      inject: [ConfigService, LocalImageStorage, ImageReferenceLookup],
    });
    for (const service of [StoreLogoService, DocumentExportService]) {
      const dependencies = Reflect.getMetadata("self:paramtypes", service) as { param: unknown }[];
      expect(dependencies.some(({ param }) => param === ImageStorageService)).toBe(true);
      expect(dependencies.some(({ param }) => param === CatalogImageStorageService)).toBe(false);
    }
    const dependencies = Reflect.getMetadata("self:paramtypes", ProductImagesService) as { param: unknown }[];
    expect(dependencies.some(({ param }) => param === CatalogImageStorageService)).toBe(true);
  });
});
