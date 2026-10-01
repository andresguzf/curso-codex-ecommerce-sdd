import { afterEach, describe, expect, it, vi } from "vitest";

const category = {
  id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  name: "Audio",
  slug: "audio",
  description: "Auriculares y altavoces",
  status: "ACTIVE" as const,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  deletedAt: null,
};
const tag = {
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  name: "Gamer",
  slug: "gamer",
  status: "ACTIVE" as const,
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  deletedAt: null,
};

describe("classification REST client", () => {
  it("requests at most three editorial selections and sends only a position or selection flag", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [{ ...category, showOnLanding: true, landingOrder: 1 }], page: 1, pageSize: 3, totalItems: 1, totalPages: 1 }))
      .mockResolvedValueOnce(Response.json({ ...category, showOnLanding: true, landingOrder: 2 }))
      .mockResolvedValueOnce(Response.json({ ...category, showOnLanding: false, landingOrder: null }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/classifications/classification-api");
    await api.listClassifications("categories", "admin-token", { showOnLanding: true, page: 1, pageSize: 3, sortBy: "name", sortOrder: "asc" });
    await api.updateClassification("categories", "admin-token", category.id, { landingOrder: 2 });
    await api.updateClassification("categories", "admin-token", category.id, { showOnLanding: false });
    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(new URL(requests[0]!.url).searchParams.get("showOnLanding")).toBe("true");
    expect(await requests[1]!.json()).toEqual({ landingOrder: 2 });
    expect(await requests[2]!.json()).toEqual({ showOnLanding: false });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("lists, creates, updates and deletes categories through the generated API", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [category], page: 2, pageSize: 10, totalItems: 13, totalPages: 2 }))
      .mockResolvedValueOnce(Response.json(category, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ...category, name: "Audio Pro" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/classifications/classification-api");
    const query = { page: 2, pageSize: 10, search: "audio", status: "ACTIVE" as const, sortBy: "name" as const, sortOrder: "asc" as const };
    expect((await api.listClassifications("categories", "admin-token", query)).totalItems).toBe(13);
    await api.createClassification("categories", "admin-token", { name: "Audio", description: category.description });
    await api.updateClassification("categories", "admin-token", category.id, { name: "Audio Pro" });
    await api.deleteClassification("categories", "admin-token", category.id);

    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(requests.map((request) => request.method)).toEqual(["GET", "POST", "PATCH", "DELETE"]);
    expect(requests[0]!.url).toContain("/api/v1/categories?");
    expect(requests[0]!.url).toContain("view=administrative");
    expect(requests[0]!.url).toContain("status=ACTIVE");
    expect(requests[1]!.url.endsWith("/api/v1/categories")).toBe(true);
    expect(requests[2]!.url.endsWith(`/api/v1/categories/${category.id}`)).toBe(true);
    expect(requests[3]!.url.endsWith(`/api/v1/categories/${category.id}`)).toBe(true);
    for (const request of requests) expect(request.headers.get("Authorization")).toBe("Bearer admin-token");
  });

  it("uses tag routes, validates responses and exposes safe duplicate errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ items: [tag], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }))
      .mockResolvedValueOnce(Response.json(tag, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ ...tag, status: "INACTIVE" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ code: "CLASSIFICATION_SLUG_ALREADY_EXISTS", message: "Private details" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("../src/features/classifications/classification-api");
    const query = { page: 1, pageSize: 20, sortBy: "createdAt" as const, sortOrder: "desc" as const };
    expect((await api.listClassifications("tags", "admin-token", query)).items[0]).toMatchObject({ id: tag.id });
    await api.createClassification("tags", "admin-token", { name: "Gamer" });
    await api.updateClassification("tags", "admin-token", tag.id, { status: "INACTIVE" });
    await api.deleteClassification("tags", "admin-token", tag.id);
    await expect(api.createClassification("tags", "admin-token", { name: "Otro", slug: "gamer" })).rejects.toMatchObject({ message: "Ese slug ya está en uso.", code: "CLASSIFICATION_SLUG_ALREADY_EXISTS" });
    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/api/v1/tags", "/api/v1/tags", `/api/v1/tags/${tag.id}`, `/api/v1/tags/${tag.id}`, "/api/v1/tags",
    ]);
  });
});
