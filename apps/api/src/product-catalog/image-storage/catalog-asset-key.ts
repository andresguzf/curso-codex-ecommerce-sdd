import { CATALOG_IMAGE_FOLDER } from "../../config/environment.js";
import { ImageStorageValidationError } from "./image-storage.port.js";

export const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOCAL_KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const CLOUD_KEY = /^cloudinary:v1:([a-zA-Z0-9_-]{1,100}):([0-9a-f-]{36}):([0-9a-f]{32})$/;

export type CloudinaryAssetIdentity = Readonly<{
  cloudName: string;
  uploadId: string;
  assetId: string;
  publicId: string;
}>;

export function parseCloudinaryAssetKey(key: string): CloudinaryAssetIdentity {
  const match = CLOUD_KEY.exec(key);
  if (!match || !UPLOAD_ID_PATTERN.test(match[2]!)) {
    throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "The catalog asset key is invalid");
  }
  return { cloudName: match[1]!, uploadId: match[2]!, assetId: match[3]!, publicId: `${CATALOG_IMAGE_FOLDER}/${match[2]}` };
}

export function cloudinaryAssetKey(identity: CloudinaryAssetIdentity): string {
  const key = `cloudinary:v1:${identity.cloudName}:${identity.uploadId}:${identity.assetId}`;
  if (parseCloudinaryAssetKey(key).publicId !== identity.publicId) {
    throw new ImageStorageValidationError("IMAGE_INVALID_KEY", "The catalog asset identity is invalid");
  }
  return key;
}

// External/seed references are intentionally not managed or remotely deletable.
export function catalogAssetProvider(key: string): "local" | "cloudinary" | "external" {
  if (LOCAL_KEY.test(key)) return "local";
  if (key.startsWith("cloudinary:")) {
    parseCloudinaryAssetKey(key);
    return "cloudinary";
  }
  return "external";
}
