import { Writable } from "node:stream";

import { v2, type UploadApiOptions, type UploadApiResponse, type UploadResponseCallback } from "cloudinary";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CloudinarySdkTransport } from "../../src/product-catalog/image-storage/cloudinary-sdk.transport.js";

const credentials = { cloud_name: "test-cloud", api_key: "test-key-only", api_secret: "test-secret-only" };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("official Cloudinary SDK transport (mocked SDK methods)", () => {
  it("uses a signed stream with per-call credentials, no disk or global config", async () => {
    const configSpy = vi.spyOn(v2, "config");
    const chunks: Buffer[] = [];
    const sdk = vi.spyOn(v2.uploader, "upload_stream").mockImplementation((_options?: UploadApiOptions | UploadResponseCallback, callback?: UploadResponseCallback) => {
      const sink = new Writable({ write(chunk: Buffer, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
      sink.on("finish", () => callback?.(undefined, { public_id: "test" } as UploadApiResponse));
      return sink as unknown as ReturnType<typeof v2.uploader.upload_stream>;
    });
    const data = Buffer.from("test-bytes");
    const result = await new CloudinarySdkTransport(credentials).upload(data, { overwrite: false, asset_folder: "codex-storefront", public_id: "codex-storefront/test", resource_type: "image", type: "upload" });
    expect(result).toEqual({ public_id: "test" });
    expect(Buffer.concat(chunks)).toEqual(data);
    expect(sdk).toHaveBeenCalledOnce();
    expect(sdk.mock.calls[0]![0]).toMatchObject({ ...credentials, secure: true, timeout: 30000, disable_promise: true, overwrite: false, asset_folder: "codex-storefront" });
    expect(configSpy).not.toHaveBeenCalled();
  });

  it("propagates SDK callback failures for the adapter to sanitize", async () => {
    vi.spyOn(v2.uploader, "upload_stream").mockImplementation((_options?: UploadApiOptions | UploadResponseCallback, callback?: UploadResponseCallback) => {
      const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
      sink.on("finish", () => callback?.({ message: "test provider failure", name: "Error", http_code: 500 }, undefined));
      return sink as unknown as ReturnType<typeof v2.uploader.upload_stream>;
    });
    await expect(new CloudinarySdkTransport(credentials).upload(Buffer.from("test"), {})).rejects.toMatchObject({ http_code: 500 });
  });

  it("uses a single explicit asset ID with invalidation, never folder deletion", async () => {
    const sdk = vi.spyOn(v2.api, "delete_resources_by_asset_ids").mockResolvedValue({ deleted: { test: "deleted" } } as never);
    await new CloudinarySdkTransport(credentials).deleteAsset("a".repeat(32));
    expect(sdk).toHaveBeenCalledWith(["a".repeat(32)], { ...credentials, resource_type: "image", type: "upload", invalidate: true, timeout: 30000 });
  });

  it("looks up a single image with ownership tags and request-scoped credentials", async () => {
    const sdk = vi.spyOn(v2.api, "resource").mockResolvedValue({ public_id: "test" } as never);
    await new CloudinarySdkTransport(credentials).resource("codex-storefront/test");
    expect(sdk).toHaveBeenCalledWith("codex-storefront/test", { ...credentials, resource_type: "image", type: "upload", tags: true, timeout: 30000 });
  });

  it("reads bounded bytes without following redirects", async () => {
    const request = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal("fetch", request);
    const sdk = new CloudinarySdkTransport(credentials);
    expect(await sdk.readBytes("https://res.cloudinary.com/test-cloud/image/upload/test.png", 3)).toEqual(Buffer.from([1, 2, 3]));
    expect(request).toHaveBeenCalledWith(expect.any(String), { redirect: "error", signal: expect.any(AbortSignal) });
    request.mockResolvedValue(new Response(new Uint8Array([1, 2, 3, 4])));
    await expect(sdk.readBytes("https://res.cloudinary.com/test-cloud/image/upload/test.png", 3)).rejects.toThrow("size limit");
  });
});
