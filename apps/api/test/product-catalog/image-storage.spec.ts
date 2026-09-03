import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ConfigService } from "@nestjs/config";
import type { FastifyReply } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type EnvironmentVariables,
  validateEnvironment,
} from "../../src/config/environment";
import { ImageReferenceLookup } from "../../src/product-catalog/image-storage/image-reference.repository";
import { ImageMediaController } from "../../src/product-catalog/image-storage/image-media.controller";
import {
  ImageStorageReferencedError,
} from "../../src/product-catalog/image-storage/image-storage.port";
import { ImageStorageService } from "../../src/product-catalog/image-storage/image-storage.service";
import { LocalImageStorage } from "../../src/product-catalog/image-storage/local-image-storage";

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from("test-image"),
]);

class StubImageReferenceLookup extends ImageReferenceLookup {
  readonly isReferenced = vi.fn<(storageKey: string) => Promise<boolean>>();
}

describe("local image storage", () => {
  let root: string;
  let storage: LocalImageStorage;
  let references: StubImageReferenceLookup;
  let service: ImageStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "technology-ecommerce-images-"));
    const environment = validateEnvironment({
      DATABASE_URL: "postgresql://postgres:password@localhost:5432/ecommerce",
      IMAGE_STORAGE_LOCAL_ROOT: root,
      IMAGE_STORAGE_MAX_BYTES: 1_024,
      IMAGE_STORAGE_PUBLIC_BASE_URL: "http://localhost:3001/api/v1/media/images",
    });
    storage = new LocalImageStorage(
      new ConfigService<EnvironmentVariables, true>(environment),
    );
    references = new StubImageReferenceLookup();
    service = new ImageStorageService(storage, references);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("uploads and reads validated bytes with stable metadata", async () => {
    const stored = await service.upload({ data: PNG_BYTES, mimeType: "image/png" });
    const content = await service.read(stored.storageKey);

    expect(stored).toMatchObject({ mimeType: "image/png", size: PNG_BYTES.length });
    expect(stored.url).toBe(
      `http://localhost:3001/api/v1/media/images/${stored.storageKey}`,
    );
    expect(content.data).toEqual(PNG_BYTES);
    expect(content.storageKey).toBe(stored.storageKey);
  });

  it("delivers stored bytes with immutable image response headers", async () => {
    const stored = await service.upload({ data: PNG_BYTES, mimeType: "image/png" });
    const reply = {
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
    } as unknown as FastifyReply;

    await new ImageMediaController(service).read(stored.storageKey, reply);

    expect(reply.type).toHaveBeenCalledWith("image/png");
    expect(reply.header).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
    expect(reply.send).toHaveBeenCalledWith(PNG_BYTES);
  });

  it("rejects unsupported, spoofed and oversized uploads", async () => {
    await expect(
      service.upload({ data: Buffer.from("not-an-image"), mimeType: "image/png" }),
    ).rejects.toMatchObject({
      code: "IMAGE_UNSUPPORTED_TYPE",
    });
    await expect(
      service.upload({ data: PNG_BYTES, mimeType: "image/jpeg" }),
    ).rejects.toMatchObject({
      code: "IMAGE_MIME_MISMATCH",
    });
    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(1_024)]);
    await expect(
      service.upload({ data: oversized, mimeType: "image/png" }),
    ).rejects.toMatchObject({
      code: "IMAGE_TOO_LARGE",
    });
  });

  it("blocks referenced deletion and deletes an unreferenced image idempotently", async () => {
    const referenced = await service.upload({ data: PNG_BYTES, mimeType: "image/png" });
    references.isReferenced.mockResolvedValueOnce(true);
    await expect(service.deleteIfUnreferenced(referenced.storageKey)).rejects.toBeInstanceOf(
      ImageStorageReferencedError,
    );
    await expect(service.read(referenced.storageKey)).resolves.toMatchObject({
      storageKey: referenced.storageKey,
    });

    references.isReferenced.mockResolvedValue(false);
    await expect(service.deleteIfUnreferenced(referenced.storageKey)).resolves.toBe(true);
    await expect(service.deleteIfUnreferenced(referenced.storageKey)).resolves.toBe(false);
  });

  it("rejects traversal and arbitrary storage keys", async () => {
    await expect(service.read("../../outside.png")).rejects.toMatchObject({
      code: "IMAGE_INVALID_KEY",
    });
  });
});
