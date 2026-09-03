import { Inject, Injectable } from "@nestjs/common";

import {
  ImageStorage,
  ImageStorageReferencedError,
  type ImageUpload,
  type StoredImage,
  type StoredImageContent,
} from "./image-storage.port";
import { ImageReferenceLookup } from "./image-reference.repository";

@Injectable()
export class ImageStorageService {
  constructor(
    @Inject(ImageStorage) private readonly storage: ImageStorage,
    @Inject(ImageReferenceLookup)
    private readonly references: ImageReferenceLookup,
  ) {}

  upload(input: ImageUpload): Promise<StoredImage> {
    return this.storage.upload(input);
  }

  read(storageKey: string): Promise<StoredImageContent> {
    return this.storage.read(storageKey);
  }

  async deleteIfUnreferenced(storageKey: string): Promise<boolean> {
    if (await this.references.isReferenced(storageKey)) {
      throw new ImageStorageReferencedError(storageKey);
    }

    return this.storage.delete(storageKey);
  }
}
