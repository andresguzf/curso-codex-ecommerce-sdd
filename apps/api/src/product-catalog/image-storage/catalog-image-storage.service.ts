import { ConfigService } from "@nestjs/config";

import type { EnvironmentVariables } from "../../config/environment";
import { ImageReferenceLookup } from "./image-reference.repository";
import { ImageStorageService } from "./image-storage.service";
import { LocalImageStorage } from "./local-image-storage";
import { CatalogImageStorageRouter } from "./catalog-image-storage-router";
import { CloudinaryImageStorage } from "./cloudinary-image-storage";

// A distinct DI token: enterprise logos and historical PDF reads remain local.
export class CatalogImageStorageService extends ImageStorageService {}

export function createCatalogImageStorageService(
  config: ConfigService<EnvironmentVariables, true>,
  local: LocalImageStorage,
  references: ImageReferenceLookup,
): CatalogImageStorageService {
  const provider = config.get("IMAGE_STORAGE_CATALOG_PROVIDER", { infer: true });
  const configured = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER_MODE"] as const;
  const cloudinary = configured.every((key) => config.get(key, { infer: true }))
    ? new CloudinaryImageStorage(config) : undefined;
  return new CatalogImageStorageService(new CatalogImageStorageRouter(local, cloudinary, provider), references);
}
