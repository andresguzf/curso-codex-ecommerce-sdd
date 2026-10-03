/** Test-process-only SDK boundary; no real Cloudinary requests or credentials. */
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { v2, type UploadApiOptions, type UploadApiResponse, type UploadResponseCallback } from "cloudinary";
import sharp from "sharp";

export function installControlledCloudinary() {
  const assets = new Map<string, { metadata: UploadApiResponse; bytes: Buffer }>();
  const uploads: Array<{ publicId: string; folder: string; overwrite: boolean }> = [];
  const deleted: string[] = [];
  let mode: "ok" | "timeout" | "unavailable" | "barrier" = "ok";
  let waiting = 0;
  let release: (() => void) | undefined;
  let barrier = Promise.resolve();
  v2.uploader.upload_stream = ((_options?: UploadApiOptions | UploadResponseCallback, callback?: UploadResponseCallback) => {
    const options = _options as UploadApiOptions;
    const chunks: Buffer[] = [];
    const stream = new Writable({ write(chunk: Buffer, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
    stream.on("finish", () => { void (async () => {
      const publicId = options.folder ? `${options.folder}/${options.public_id}` : String(options.public_id);
      uploads.push({ publicId, folder: String(options.asset_folder ?? options.folder), overwrite: Boolean(options.overwrite) });
      if (mode === "unavailable") { mode = "ok"; callback?.({ name: "Error", message: "controlled outage", http_code: 503 }); return; }
      const bytes = Buffer.concat(chunks);
      const dimensions = await sharp(bytes).metadata();
      const metadata = { asset_id: randomUUID().replaceAll("-", ""), public_id: publicId,
        resource_type: "image", type: "upload", format: "png", bytes: bytes.length,
        width: dimensions.width!, height: dimensions.height!, asset_folder: "codex-storefront",
        tags: options.tags, secure_url: `https://res.cloudinary.com/browser-test/image/upload/v123/${publicId}.png` } as unknown as UploadApiResponse;
      assets.set(publicId, { metadata, bytes });
      if (mode === "timeout") { mode = "ok"; callback?.({ name: "Error", message: "controlled accepted timeout", http_code: 499 }); return; }
      if (mode === "barrier") { if (++waiting === 2) { mode = "ok"; release?.(); } await barrier; }
      callback?.(undefined, metadata);
    })().catch(() => callback?.({ name: "Error", message: "controlled fixture failure", http_code: 500 })); });
    return stream;
  }) as typeof v2.uploader.upload_stream;
  v2.api.resource = (async (publicId: string) => {
    const asset = assets.get(publicId);
    if (!asset) throw { error: { http_code: 404 } };
    return asset.metadata;
  }) as typeof v2.api.resource;
  v2.api.delete_resources_by_asset_ids = (async (ids: string[]) => {
    if (ids.length !== 1) throw new Error("Only single-asset cleanup is allowed");
    const found = [...assets].find(([, asset]) => asset.metadata.asset_id === ids[0]);
    if (!found) return { deleted: { [ids[0]!]: "not_found" } };
    assets.delete(found[0]); deleted.push(ids[0]!);
    return { deleted: { [ids[0]!]: "deleted" } };
  }) as unknown as typeof v2.api.delete_resources_by_asset_ids;
  return {
    stats: () => ({ uploads, deleted, assets: [...assets.values()].map((asset) => asset.metadata) }),
    bytes: (id: string) => [...assets.values()].find((asset) => asset.metadata.asset_id === id)?.bytes,
    control: (next: string) => {
      if (!["ok", "timeout", "unavailable", "barrier"].includes(next)) throw new Error("Invalid controlled mode");
      mode = next as typeof mode;
      if (mode === "barrier") { waiting = 0; barrier = new Promise<void>((resolve) => { release = resolve; }); }
    },
  };
}
