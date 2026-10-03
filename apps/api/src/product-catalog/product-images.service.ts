import { BadGatewayException, BadRequestException, GatewayTimeoutException, Inject, Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import sharp from "sharp";

import { ImageStorageValidationError } from "./image-storage/image-storage.port";
import { CatalogImageStorageService } from "./image-storage/catalog-image-storage.service";
import { ProductImagesRepository, type ImagePatch } from "./product-images.repository";
import { CloudinaryStorageError } from "./image-storage/cloudinary-image-storage";
import { catalogAssetProvider } from "./image-storage/catalog-asset-key";
import { CatalogImageRecoveryService } from "./image-storage/catalog-image-recovery.service";

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);
  constructor(@Inject(ProductImagesRepository) private readonly repository: ProductImagesRepository,
    @Inject(CatalogImageStorageService) private readonly storage: CatalogImageStorageService,
    @Inject(CatalogImageRecoveryService) private readonly recovery: CatalogImageRecoveryService) {}

  async add(productId: string, actorId: string, data: unknown, mimeType: string | undefined, patch: ImagePatch & { altText: string }) {
    if (!Buffer.isBuffer(data) || !mimeType) throw new BadRequestException({ code: "IMAGE_INVALID", message: "Upload a PNG, JPEG or WebP image" });
    await this.repository.assertUploadAllowed(productId, patch);
    let metadata;
    try {
      const image = sharp(data);
      metadata = await image.metadata();
      if (!metadata.width || !metadata.height) throw new Error("Invalid dimensions");
      await image.stats();
    } catch {
      throw new BadRequestException({ code: "IMAGE_INVALID", message: "The image cannot be decoded" });
    }
    let stored;
    try {
      if (this.recovery.enabled) {
        return await this.recovery.uploadAndConfirm({ data, mimeType }, (asset, operationId) => this.repository.mutate(productId, actorId, {
          kind: "add", operationId, asset: { storageKey: asset.storageKey, url: asset.url, mimeType: asset.mimeType, width: metadata.width!, height: metadata.height! }, patch,
        }));
      }
      stored = await this.storage.upload({ data, mimeType });
    } catch (error) {
      if (error instanceof ImageStorageValidationError) {
        const response = { code: error.code, message: error.message };
        if (error.code === "IMAGE_TOO_LARGE") throw new PayloadTooLargeException(response);
        throw new BadRequestException(response);
      }
      if (error instanceof CloudinaryStorageError) {
        if (error.kind === "timeout") throw new GatewayTimeoutException({ code: "IMAGE_STORAGE_TIMEOUT", message: "Image storage timed out. Recover the gallery before retrying." });
        if (error.kind === "upstream") throw new BadGatewayException({ code: "IMAGE_STORAGE_UPSTREAM_ERROR", message: "Image storage returned an invalid response." });
        throw new ServiceUnavailableException({ code: "IMAGE_STORAGE_UNAVAILABLE", message: "Image storage is temporarily unavailable." });
      }
      throw error;
    }
    try {
      return await this.repository.mutate(productId, actorId, { kind: "add", asset: { storageKey: stored.storageKey, url: stored.url, mimeType: stored.mimeType, width: metadata.width!, height: metadata.height! }, patch });
    } catch (error) {
      await this.cleanup(stored.storageKey);
      throw error;
    }
  }

  edit(productId: string, imageId: string, actorId: string, patch: ImagePatch) {
    return this.repository.mutate(productId, actorId, { kind: "edit", imageId, patch });
  }

  async delete(productId: string, imageId: string, actorId: string): Promise<void> {
    const removed = await this.repository.mutate(productId, actorId, { kind: "delete", imageId });
    // Legacy/seed references are read-only; route managed keys by asset origin.
    try {
      if (catalogAssetProvider(removed.storageKey) === "local") await this.cleanup(removed.storageKey);
    } catch {
      this.logger.warn({ event: "product.image.cleanup_invalid_key", imageId });
    }
  }

  private async cleanup(storageKey: string): Promise<void> {
    try {
      await this.storage.deleteIfUnreferenced(storageKey);
    } catch {
      // Never undo a committed gallery change or mask the original DB error.
      // Retain the file safely; the audit/log key supports operational cleanup.
      this.logger.warn({ event: "product.image.cleanup_pending", storageKey });
    }
  }
}
