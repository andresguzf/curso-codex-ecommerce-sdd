import { randomUUID } from "node:crypto";

import type { ConfigService } from "@nestjs/config";
import sharp from "sharp";
import { z } from "zod";

import { CATALOG_IMAGE_FOLDER, type EnvironmentVariables } from "../../config/environment";
import { cloudinaryAssetKey, parseCloudinaryAssetKey, UPLOAD_ID_PATTERN } from "./catalog-asset-key";
import { CLOUDINARY_TIMEOUT_MS, CloudinarySdkTransport, type CloudinaryTransport } from "./cloudinary-sdk.transport";
import { detectImageMimeType } from "./image-signature";
import { ImageStorage, ImageStorageNotFoundError, ImageStorageValidationError, type ImageUpload, type StoredImage, type StoredImageContent, type SupportedImageMimeType } from "./image-storage.port";

export const CATALOG_ASSET_TAG = "technology-ecommerce-catalog";
const responseSchema = z.object({
  asset_id: z.string().regex(/^[0-9a-f]{32}$/), public_id: z.string(),
  resource_type: z.literal("image"), type: z.literal("upload"),
  secure_url: z.string().url(), format: z.enum(["png", "jpg", "jpeg", "webp"]),
  bytes: z.number().int().positive(), width: z.number().int().positive(), height: z.number().int().positive(),
  asset_folder: z.string().optional(), tags: z.array(z.string()),
});

export class CloudinaryStorageError extends Error {
  constructor(readonly kind: "unavailable" | "timeout" | "upstream", readonly uploadId?: string) {
    super(kind === "timeout" ? "Image storage timed out" : kind === "upstream" ? "Image storage returned an invalid response" : "Image storage is unavailable");
    this.name = "CloudinaryStorageError";
  }
}

export class CloudinaryImageStorage extends ImageStorage {
  private readonly cloudName: string;
  private readonly mode: "dynamic" | "fixed";
  private readonly maxBytes: number;
  private readonly transport: CloudinaryTransport;

  get configuredCloudName(): string { return this.cloudName; }

  async findUpload(uploadId: string): Promise<StoredImage | undefined> {
    if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "The upload identity is invalid");
    const publicId = `${CATALOG_IMAGE_FOLDER}/${uploadId}`;
    try {
      const response = await this.call(() => this.transport.resource(publicId), uploadId, publicId);
      return this.validateResponse(response, publicId, uploadId);
    } catch (error) {
      if (error instanceof ImageStorageNotFoundError) return undefined;
      throw error;
    }
  }

  constructor(config: ConfigService<EnvironmentVariables, true>, transport?: CloudinaryTransport) {
    super();
    const cloudName = config.get("CLOUDINARY_CLOUD_NAME", { infer: true });
    const apiKey = config.get("CLOUDINARY_API_KEY", { infer: true });
    const apiSecret = config.get("CLOUDINARY_API_SECRET", { infer: true });
    const mode = config.get("CLOUDINARY_FOLDER_MODE", { infer: true });
    if (!cloudName || !/^[a-zA-Z0-9_-]{1,100}$/.test(cloudName) || !apiKey || !apiSecret || !mode) {
      throw new Error("Cloudinary catalog storage requires complete private configuration and an explicit folder mode");
    }
    this.cloudName = cloudName;
    this.mode = mode;
    this.maxBytes = config.get("IMAGE_STORAGE_MAX_BYTES", { infer: true });
    this.transport = transport ?? new CloudinarySdkTransport({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  }

  // Caller may generate/persist this ID before upload in the recovery workflow.
  async upload(input: ImageUpload, uploadId: string = randomUUID()): Promise<StoredImage> {
    if (!UPLOAD_ID_PATTERN.test(uploadId)) throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "The upload identity is invalid");
    const expected = await this.validateBytes(input);
    const publicId = `${CATALOG_IMAGE_FOLDER}/${uploadId}`;
    const options = {
      resource_type: "image" as const, type: "upload" as const, overwrite: false,
      use_filename: false, unique_filename: false, tags: [CATALOG_ASSET_TAG],
      ...(this.mode === "dynamic"
        ? { asset_folder: CATALOG_IMAGE_FOLDER, public_id: publicId, use_asset_folder_as_public_id_prefix: false }
        : { folder: CATALOG_IMAGE_FOLDER, public_id: uploadId }),
    };
    const response = await this.call(() => this.transport.upload(input.data, options), uploadId);
    const asset = this.validateResponse(response, publicId, uploadId, expected);
    if (asset.mimeType !== expected.mimeType || asset.size !== input.data.length) throw new CloudinaryStorageError("upstream", uploadId);
    return asset;
  }

  async read(storageKey: string): Promise<StoredImageContent> {
    const asset = await this.lookup(storageKey);
    const data = await this.call(() => this.transport.readBytes(asset.url, this.maxBytes));
    const decoded = await this.validateBytes({ data, mimeType: asset.mimeType });
    if (data.length !== asset.size || decoded.mimeType !== asset.mimeType) throw new CloudinaryStorageError("upstream");
    return { ...asset, data };
  }

  async delete(storageKey: string): Promise<boolean> {
    const identity = this.identity(storageKey);
    try { await this.lookup(storageKey); } catch (error) {
      if (error instanceof ImageStorageNotFoundError) return false;
      throw error;
    }
    const response = await this.call(() => this.transport.deleteAsset(identity.assetId));
    const parsed = z.object({ deleted: z.record(z.string(), z.enum(["deleted", "not_found"])) }).safeParse(response);
    // Admin API may report deletion statuses keyed by public ID.
    const status = parsed.success ? parsed.data.deleted[identity.publicId] ?? parsed.data.deleted[identity.assetId] : undefined;
    if (!status) throw new CloudinaryStorageError("upstream");
    return status === "deleted";
  }

  private identity(storageKey: string) {
    const identity = parseCloudinaryAssetKey(storageKey);
    if (identity.cloudName !== this.cloudName) throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "The asset belongs to another cloud");
    return identity;
  }

  private async lookup(storageKey: string): Promise<StoredImage> {
    const identity = this.identity(storageKey);
    const response = await this.call(() => this.transport.resource(identity.publicId), identity.uploadId, storageKey);
    const asset = this.validateResponse(response, identity.publicId, identity.uploadId);
    if (asset.storageKey !== storageKey) throw new CloudinaryStorageError("upstream");
    return asset;
  }

  private validateResponse(response: unknown, publicId: string, uploadId: string, expected?: Readonly<{ width: number; height: number }>): StoredImage {
    const parsed = responseSchema.safeParse(response);
    if (!parsed.success) throw new CloudinaryStorageError("upstream", uploadId);
    const asset = parsed.data;
    const format = asset.format === "jpeg" ? "jpg" : asset.format;
    const url = new URL(asset.secure_url);
    const expectedPath = new RegExp(`^/${this.cloudName}/image/upload/v[0-9]+/${publicId}\\.${format}$`);
    if (asset.public_id !== publicId || !asset.tags.includes(CATALOG_ASSET_TAG)
      || (this.mode === "dynamic" && asset.asset_folder !== CATALOG_IMAGE_FOLDER)
      || (asset.asset_folder !== undefined && asset.asset_folder !== CATALOG_IMAGE_FOLDER)
      || url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.port || url.username || url.password || url.search || url.hash
      || !expectedPath.test(url.pathname) || asset.bytes > this.maxBytes
      || (expected && (asset.width !== expected.width || asset.height !== expected.height))) {
      throw new CloudinaryStorageError("upstream", uploadId);
    }
    const mimeType: SupportedImageMimeType = format === "jpg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
    return { storageKey: cloudinaryAssetKey({ cloudName: this.cloudName, uploadId, assetId: asset.asset_id, publicId }), url: asset.secure_url, mimeType, size: asset.bytes };
  }

  private async validateBytes(input: ImageUpload): Promise<Readonly<{ mimeType: SupportedImageMimeType; width: number; height: number }>> {
    if (input.data.length === 0) throw new ImageStorageValidationError("IMAGE_EMPTY", "The image is empty");
    if (input.data.length > this.maxBytes) throw new ImageStorageValidationError("IMAGE_TOO_LARGE", "The image exceeds the configured byte limit");
    const mime = detectImageMimeType(input.data);
    if (mime !== input.mimeType.toLowerCase()) throw new ImageStorageValidationError("IMAGE_MIME_MISMATCH", "The image type does not match its content");
    try {
      const image = sharp(input.data);
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || !["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error("Invalid image");
      await image.stats(); // Decode before any external upload, not only its header.
      return { mimeType: mime, width: metadata.width, height: metadata.height };
    } catch {
      throw new ImageStorageValidationError("IMAGE_UNSUPPORTED_TYPE", "The image cannot be decoded");
    }
  }

  private async call<T>(operation: () => Promise<T>, uploadId?: string, missingKey?: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([operation(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CloudinaryStorageError("timeout", uploadId)), CLOUDINARY_TIMEOUT_MS);
      })]);
    } catch (error) {
      if (error instanceof CloudinaryStorageError) throw error;
      const source = error && typeof error === "object" ? error as { http_code?: number; code?: string; name?: string; error?: { http_code?: number } } : {};
      if (missingKey && (source.http_code === 404 || source.error?.http_code === 404)) throw new ImageStorageNotFoundError(missingKey);
      throw new CloudinaryStorageError(source.http_code === 499 || source.code === "ETIMEDOUT" || source.name === "TimeoutError" ? "timeout" : "unavailable", uploadId);
    } finally { if (timer) clearTimeout(timer); }
  }
}
