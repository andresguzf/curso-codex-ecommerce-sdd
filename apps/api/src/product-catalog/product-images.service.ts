import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import sharp from "sharp";

import { ImageStorageValidationError } from "./image-storage/image-storage.port";
import { ImageStorageService } from "./image-storage/image-storage.service";
import { ProductImagesRepository, type ImagePatch } from "./product-images.repository";

@Injectable()
export class ProductImagesService {
  private readonly logger = new Logger(ProductImagesService.name);
  constructor(@Inject(ProductImagesRepository) private readonly repository: ProductImagesRepository, @Inject(ImageStorageService) private readonly storage: ImageStorageService) {}

  async add(productId: string, actorId: string, data: unknown, mimeType: string | undefined, patch: ImagePatch & { altText: string }) {
    if (!Buffer.isBuffer(data) || !mimeType) throw new BadRequestException({ code: "IMAGE_INVALID", message: "Upload a PNG, JPEG or WebP image" });
    let stored;
    try {
      stored = await this.storage.upload({ data, mimeType });
    } catch (error) {
      if (error instanceof ImageStorageValidationError) throw new BadRequestException({ code: error.code, message: error.message });
      throw error;
    }
    try {
      let metadata;
      try {
        metadata = await sharp(data).metadata();
      } catch {
        throw new BadRequestException({ code: "IMAGE_INVALID", message: "The image cannot be decoded" });
      }
      if (!metadata.width || !metadata.height) throw new BadRequestException({ code: "IMAGE_INVALID", message: "The image has no valid dimensions" });
      return await this.repository.mutate(productId, actorId, { kind: "add", asset: { storageKey: stored.storageKey, url: stored.url, mimeType: stored.mimeType, width: metadata.width, height: metadata.height }, patch });
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
    // Legacy/CDN references are not owned by the local adapter. Never delete
    // arbitrary paths or remote assets. Managed uploads use opaque UUID keys.
    if (/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(removed.storageKey)) await this.cleanup(removed.storageKey);
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
