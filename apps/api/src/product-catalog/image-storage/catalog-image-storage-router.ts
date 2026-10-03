import { catalogAssetProvider } from "./catalog-asset-key";
import { ImageStorage, ImageStorageValidationError, type ImageUpload, type StoredImage, type StoredImageContent } from "./image-storage.port";

// Upload selection is separate from asset origin; existing references never migrate.
export class CatalogImageStorageRouter extends ImageStorage {
  constructor(private readonly local: ImageStorage, private readonly cloudinary: ImageStorage | undefined, private readonly uploadProvider: "local" | "cloudinary") { super(); }

  upload(input: ImageUpload): Promise<StoredImage> {
    return this.provider(this.uploadProvider).upload(input);
  }

  read(key: string): Promise<StoredImageContent> { return this.forKey(key).read(key); }
  delete(key: string): Promise<boolean> { return this.forKey(key).delete(key); }

  private forKey(key: string): ImageStorage {
    const origin = catalogAssetProvider(key);
    if (origin === "external") throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "External images are not managed assets");
    return this.provider(origin);
  }

  private provider(origin: "local" | "cloudinary"): ImageStorage {
    if (origin === "local") return this.local;
    if (!this.cloudinary) throw new Error("Cloudinary configuration is required to manage this asset");
    return this.cloudinary;
  }
}
