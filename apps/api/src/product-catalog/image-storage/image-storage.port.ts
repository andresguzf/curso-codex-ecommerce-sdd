export type SupportedImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export type ImageUpload = Readonly<{
  data: Buffer;
  mimeType: string;
}>;

export type StoredImage = Readonly<{
  storageKey: string;
  url: string;
  mimeType: SupportedImageMimeType;
  size: number;
}>;

export type StoredImageContent = StoredImage &
  Readonly<{
    data: Buffer;
  }>;

export abstract class ImageStorage {
  abstract upload(input: ImageUpload): Promise<StoredImage>;
  abstract read(storageKey: string): Promise<StoredImageContent>;
  abstract delete(storageKey: string): Promise<boolean>;
}

export class ImageStorageValidationError extends Error {
  constructor(
    readonly code:
      | "IMAGE_EMPTY"
      | "IMAGE_INVALID_KEY"
      | "IMAGE_MIME_MISMATCH"
      | "IMAGE_TOO_LARGE"
      | "IMAGE_UNSUPPORTED_TYPE",
    message: string,
  ) {
    super(message);
    this.name = "ImageStorageValidationError";
  }
}

export class ImageStorageNotFoundError extends Error {
  constructor(readonly storageKey: string) {
    super("The stored image does not exist");
    this.name = "ImageStorageNotFoundError";
  }
}

export class ImageStorageReferencedError extends Error {
  constructor(readonly storageKey: string) {
    super("A referenced image cannot be deleted");
    this.name = "ImageStorageReferencedError";
  }
}
