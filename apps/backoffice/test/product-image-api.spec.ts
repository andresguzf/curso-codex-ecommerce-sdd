// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const productId = "4dff7cda-b8e6-459d-b187-dc6fb8f2582c";
const imageId = "18ef6b72-3291-4bd7-a68f-0eec92d54d7c";
const image = {
  id: imageId, productId, storageKey: "products/keyboard.png", url: "/uploads/keyboard.png",
  altText: "Teclado", isPrimary: true, sortOrder: 0, width: 800, height: 600, mimeType: "image/png",
  createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
};
const cover = { id: imageId, storageKey: image.storageKey, url: image.url, altText: image.altText,
  isPrimary: true, sortOrder: 0, width: 800, height: 600, mimeType: "image/png" };
const detail = {
  id: productId, sku: "KEY-01", slug: "teclado", name: "Teclado", description: "Teclado mecánico",
  price: "89.00", currency: "USD", status: "INACTIVE", category: null, tags: [],
  image: { storageKey: image.storageKey, url: image.url }, coverImage: cover, images: [cover],
  stockAvailable: 0, availability: "OUT_OF_STOCK", createdAt: image.createdAt, updatedAt: image.updatedAt,
};
const file = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
type Api = typeof import("../src/features/products/product-image-api");
const operations = {
  get: (api: Api, signal?: AbortSignal) => api.getAdministrativeProductGallery("admin-token", productId, signal),
  upload: (api: Api, signal?: AbortSignal) => api.uploadProductImage("admin-token", productId, file(), { altText: "Teclado" }, signal),
  update: (api: Api, signal?: AbortSignal) => api.updateProductImage("admin-token", productId, imageId, { altText: "Teclado" }, signal),
  delete: (api: Api, signal?: AbortSignal) => api.deleteProductImage("admin-token", productId, imageId, signal),
};

describe("administrative product gallery REST adapters", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

  it("uses administrative detail and existing mutation routes with Bearer and credentials", async () => {
    const requests: Request[] = [];
    const replies = [Response.json(detail), Response.json(image, { status: 201 }), Response.json(image), new Response(null, { status: 204 })];
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Request(input, init));
      return Promise.resolve(replies.shift()!);
    }));
    const api = await import("../src/features/products/product-image-api");
    expect((await api.getAdministrativeProductGallery("admin-token", productId)).images).toEqual([cover]);
    expect(await api.uploadProductImage("admin-token", productId, file(), { altText: "  Teclado & luces  ", isPrimary: false, sortOrder: 0 })).toEqual(image);
    expect(await api.updateProductImage("admin-token", productId, imageId, { altText: "  Nueva portada  ", isPrimary: true, sortOrder: 0 })).toEqual(image);
    expect(await api.deleteProductImage("admin-token", productId, imageId)).toBeUndefined();
    expect(requests.map((request) => request.method)).toEqual(["GET", "POST", "PATCH", "DELETE"]);
    expect(new URL(requests[0].url).searchParams.get("view")).toBe("administrative");
    expect(Object.fromEntries(new URL(requests[1].url).searchParams)).toEqual({ altText: "Teclado & luces", isPrimary: "false", sortOrder: "0" });
    expect(new URL(requests[1].url).pathname).toBe(`/api/v1/products/${productId}/images`);
    expect(new URL(requests[2].url).pathname).toBe(`/api/v1/products/${productId}/images/${imageId}`);
    expect(new URL(requests[3].url).pathname).toBe(new URL(requests[2].url).pathname);
    expect(await requests[2].json()).toEqual({ altText: "Nueva portada", isPrimary: true, sortOrder: 0 });
    expect(requests[1].headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await requests[1].arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    for (const request of requests) {
      expect(request.headers.get("authorization")).toBe("Bearer admin-token");
      expect(request.credentials).toBe("include");
    }
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("sends %s as raw bytes without optional query defaults", async (type) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(image, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    const blob = new Blob(["bytes"], { type });
    await api.uploadProductImage("token", productId, blob, { altText: "Vista" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).searchParams.toString()).toBe("altText=Vista");
    expect(init.body).toBe(blob);
    expect(new Headers(init.headers).get("content-type")).toBe(type);
  });

  it("rejects invalid IDs, metadata and files before making requests", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    const calls = [
      () => api.getAdministrativeProductGallery("token", "not-a-uuid"),
      () => api.deleteProductImage("token", productId, "invalid"),
      () => api.updateProductImage("token", productId, imageId, {}),
      () => api.updateProductImage("token", productId, imageId, { sortOrder: -1 }),
      () => api.uploadProductImage("token", productId, file(), { altText: " " }),
      () => api.uploadProductImage("token", productId, file(), { altText: "x".repeat(501) }),
      () => api.uploadProductImage("token", productId, new Blob([], { type: "image/png" }), { altText: "Vista" }),
      () => api.uploadProductImage("token", productId, new Blob(["svg"], { type: "image/svg+xml" }), { altText: "Vista" }),
    ];
    for (const call of calls) await expect(call()).rejects.toMatchObject({ status: 400, code: "PRODUCT_IMAGE_REQUEST_INVALID" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(Object.keys(operations) as (keyof typeof operations)[])("preserves cancellation for %s without retry", async (operation) => {
    const controller = new AbortController();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const signal = input instanceof Request ? input.signal : init?.signal;
      expect(signal).toBeDefined();
      return new Promise((_resolve, reject) => {
        if (signal!.aborted) { reject(signal!.reason); return; }
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    const result = operations[operation](api, controller.signal);
    const aborted = new DOMException("Aborted", "AbortError");
    controller.abort(aborted);
    await expect(result).rejects.toBe(aborted);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(Object.keys(operations) as (keyof typeof operations)[])("uses safe authorization errors for %s", async (operation) => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    for (const status of [401, 403, 404]) {
      fetchMock.mockResolvedValueOnce(Response.json({ code: "ACCESS_DENIED", message: "secret internal detail" }, { status }));
      try { await operations[operation](api); throw new Error("Expected rejection"); }
      catch (error) {
        expect(error).toBeInstanceOf(api.ProductImageApiError);
        expect(error).toMatchObject({ status });
        expect((error as Error).message).not.toContain("secret");
      }
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("handles quota, cover and size failures without surfacing server messages", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    for (const [status, code, message] of [
      [409, "PRODUCT_IMAGE_LIMIT_REACHED", "cuatro imágenes"],
      [409, "PRODUCT_PRIMARY_IMAGE_REQUIRED", "otra portada"],
      [413, "IMAGE_TOO_LARGE", "tamaño permitido"],
      [400, "IMAGE_INVALID", "formato"],
    ] as const) {
      fetchMock.mockResolvedValueOnce(Response.json({ code, message: "private server text" }, { status }));
      await expect(operations.upload(api)).rejects.toMatchObject({ status, code, message: expect.stringContaining(message) });
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each(["get", "upload", "update"] as const)("rejects malformed successful %s data safely", async (operation) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ secret: "invalid server data" }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    await expect(operations[operation](api)).rejects.toMatchObject({ status: 502, code: "PRODUCT_IMAGE_RESPONSE_INVALID" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed JSON and unexpected deletion status", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("invalid json", { headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(Response.json({ ignored: true }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    await expect(operations.upload(api)).rejects.toMatchObject({ status: 502 });
    await expect(operations.delete(api)).rejects.toMatchObject({ status: 502 });
  });

  it.each(Object.keys(operations) as (keyof typeof operations)[])("sanitizes transport failures for %s and makes only one attempt", async (operation) => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("private URL/token"));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/products/product-image-api");
    await expect(operations[operation](api)).rejects.toMatchObject({ status: 0, message: expect.not.stringContaining("private") });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
