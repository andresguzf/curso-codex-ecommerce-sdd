import { v2, type UploadApiOptions } from "cloudinary";

export interface CloudinaryTransport {
  upload(data: Buffer, options: UploadApiOptions): Promise<unknown>;
  resource(publicId: string): Promise<unknown>;
  deleteAsset(assetId: string): Promise<unknown>;
  readBytes(url: string, maxBytes: number): Promise<Buffer>;
}

export const CLOUDINARY_TIMEOUT_MS = 30_000;

export class CloudinarySdkTransport implements CloudinaryTransport {
  constructor(private readonly credentials: Readonly<{ cloud_name: string; api_key: string; api_secret: string }>) {}

  upload(data: Buffer, options: UploadApiOptions): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Credentials are per request: never mutate the SDK's global config.
      const stream = v2.uploader.upload_stream({
        ...options, ...this.credentials, secure: true, timeout: CLOUDINARY_TIMEOUT_MS,
        disable_promise: true,
      }, (error, result) => error ? reject(error) : resolve(result));
      stream.on("error", reject);
      stream.end(data);
    });
  }

  resource(publicId: string): Promise<unknown> {
    return v2.api.resource(publicId, {
      ...this.credentials, resource_type: "image", type: "upload", tags: true,
      timeout: CLOUDINARY_TIMEOUT_MS,
    });
  }

  deleteAsset(assetId: string): Promise<unknown> {
    // Stable asset identity avoids deleting a replacement at the same public ID.
    return v2.api.delete_resources_by_asset_ids([assetId], {
      ...this.credentials, resource_type: "image", type: "upload", invalidate: true,
      timeout: CLOUDINARY_TIMEOUT_MS,
    });
  }

  async readBytes(url: string, maxBytes: number): Promise<Buffer> {
    const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(CLOUDINARY_TIMEOUT_MS) });
    if (!response.ok || !response.body) throw new Error("Cloudinary delivery failed");
    const chunks: Buffer[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > maxBytes) throw new Error("Cloudinary delivery exceeds size limit");
        chunks.push(Buffer.from(next.value));
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return Buffer.concat(chunks);
  }
}
