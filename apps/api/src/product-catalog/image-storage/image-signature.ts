import {
  ImageStorageValidationError,
  type SupportedImageMimeType,
} from "./image-storage.port";

const SIGNATURES: ReadonlyArray<
  Readonly<{
    mimeType: SupportedImageMimeType;
    matches: (data: Buffer) => boolean;
  }>
> = [
  {
    mimeType: "image/jpeg",
    matches: (data) =>
      data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  {
    mimeType: "image/png",
    matches: (data) =>
      data.length >= 8 &&
      data.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
  },
  {
    mimeType: "image/webp",
    matches: (data) =>
      data.length >= 12 &&
      data.subarray(0, 4).toString("ascii") === "RIFF" &&
      data.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export function detectImageMimeType(data: Buffer): SupportedImageMimeType {
  const signature = SIGNATURES.find((candidate) => candidate.matches(data));

  if (!signature) {
    throw new ImageStorageValidationError(
      "IMAGE_UNSUPPORTED_TYPE",
      "Only JPEG, PNG and WebP images are supported",
    );
  }

  return signature.mimeType;
}

export function extensionFor(mimeType: SupportedImageMimeType): string {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] ?? "";
}
