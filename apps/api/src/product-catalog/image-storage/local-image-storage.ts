import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/environment";
import {
  ImageStorage,
  ImageStorageNotFoundError,
  ImageStorageValidationError,
  type ImageUpload,
  type StoredImage,
  type StoredImageContent,
  type SupportedImageMimeType,
} from "./image-storage.port";
import { detectImageMimeType, extensionFor } from "./image-signature";

const STORAGE_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

@Injectable()
export class LocalImageStorage extends ImageStorage {
  private readonly root: string;
  private readonly maxBytes: number;
  private readonly publicBaseUrl: string;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    super();
    this.root = resolve(config.get("IMAGE_STORAGE_LOCAL_ROOT", { infer: true }));
    this.maxBytes = config.get("IMAGE_STORAGE_MAX_BYTES", { infer: true });
    this.publicBaseUrl = config
      .get("IMAGE_STORAGE_PUBLIC_BASE_URL", { infer: true })
      .replace(/\/$/, "");
  }

  async upload(input: ImageUpload): Promise<StoredImage> {
    this.assertAllowedSize(input.data);
    const detectedMimeType = detectImageMimeType(input.data);

    if (input.mimeType.toLowerCase() !== detectedMimeType) {
      throw new ImageStorageValidationError(
        "IMAGE_MIME_MISMATCH",
        "The declared image type does not match its content",
      );
    }

    await mkdir(this.root, { recursive: true });
    const storageKey = `${randomUUID()}.${extensionFor(detectedMimeType)}`;
    const destination = this.pathFor(storageKey);
    const temporary = `${destination}.${randomUUID()}.tmp`;

    try {
      await writeFile(temporary, input.data, { flag: "wx", mode: 0o600 });
      await rename(temporary, destination);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }

    return this.metadata(storageKey, detectedMimeType, input.data.byteLength);
  }

  async read(storageKey: string): Promise<StoredImageContent> {
    const path = this.pathFor(storageKey);
    let data: Buffer;

    try {
      data = await readFile(path);
    } catch (error) {
      if (this.isMissingFile(error)) {
        throw new ImageStorageNotFoundError(storageKey);
      }
      throw error;
    }

    const mimeType = detectImageMimeType(data);
    const expectedExtension = extensionFor(mimeType);

    if (!storageKey.endsWith(`.${expectedExtension}`)) {
      throw new ImageStorageValidationError(
        "IMAGE_MIME_MISMATCH",
        "The stored image extension does not match its content",
      );
    }

    return { ...this.metadata(storageKey, mimeType, data.byteLength), data };
  }

  async delete(storageKey: string): Promise<boolean> {
    const path = this.pathFor(storageKey);

    try {
      await unlink(path);
      return true;
    } catch (error) {
      if (this.isMissingFile(error)) return false;
      throw error;
    }
  }

  private assertAllowedSize(data: Buffer): void {
    if (data.byteLength === 0) {
      throw new ImageStorageValidationError("IMAGE_EMPTY", "The image is empty");
    }
    if (data.byteLength > this.maxBytes) {
      throw new ImageStorageValidationError(
        "IMAGE_TOO_LARGE",
        `The image exceeds the ${this.maxBytes} byte limit`,
      );
    }
  }

  private pathFor(storageKey: string): string {
    if (!STORAGE_KEY_PATTERN.test(storageKey)) {
      throw new ImageStorageValidationError(
        "IMAGE_INVALID_KEY",
        "The image storage key is invalid",
      );
    }
    return resolve(this.root, storageKey);
  }

  private metadata(
    storageKey: string,
    mimeType: SupportedImageMimeType,
    size: number,
  ): StoredImage {
    return {
      storageKey,
      url: `${this.publicBaseUrl}/${encodeURIComponent(storageKey)}`,
      mimeType,
      size,
    };
  }

  private isMissingFile(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    );
  }
}
