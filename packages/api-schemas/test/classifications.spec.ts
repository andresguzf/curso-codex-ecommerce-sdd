import { describe, expect, it } from "vitest";

import {
  categoryPageSchema,
  classificationListQuerySchema,
  createCategoryRequestSchema,
  createTagRequestSchema,
  tagPageSchema,
  updateCategoryRequestSchema,
  updateTagRequestSchema,
} from "../src/classifications";

const baseRecord = {
  id: "8f732799-c098-45c1-961e-332c6becd13a",
  name: "Periféricos",
  slug: "perifericos",
  status: "ACTIVE",
  createdAt: "2026-09-03T12:00:00.000Z",
  updatedAt: "2026-09-03T12:00:00.000Z",
  deletedAt: null,
};

describe("classification HTTP schemas", () => {
  it("validates editorial category patches without accepting them on tags or creation", () => {
    expect(updateCategoryRequestSchema.parse({ showOnLanding: true, landingOrder: 3 })).toEqual({ showOnLanding: true, landingOrder: 3 });
    expect(updateCategoryRequestSchema.parse({ showOnLanding: false, landingOrder: null })).toEqual({ showOnLanding: false, landingOrder: null });
    for (const landingOrder of [0, 4, 1.5, "1"]) expect(updateCategoryRequestSchema.safeParse({ landingOrder }).success).toBe(false);
    expect(updateCategoryRequestSchema.safeParse({ showOnLanding: "true" }).success).toBe(false);
    expect(updateTagRequestSchema.safeParse({ showOnLanding: true }).success).toBe(false);
    expect(createCategoryRequestSchema.safeParse({ name: "Demo", showOnLanding: true }).success).toBe(false);
    const response = { items: [{ ...baseRecord, description: "Demo", showOnLanding: true, landingOrder: 2 }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    expect(categoryPageSchema.parse(response).items[0]).toMatchObject({ showOnLanding: true, landingOrder: 2 });
  });
  it("validates category and tag requests against the REST contract", () => {
    expect(createCategoryRequestSchema.safeParse({ name: "Periféricos" }).success).toBe(true);
    expect(createTagRequestSchema.safeParse({ name: "Gamer", slug: "gamer" }).success).toBe(true);
    expect(createCategoryRequestSchema.safeParse({ name: "", role: "ADMIN" }).success).toBe(false);
    expect(createTagRequestSchema.safeParse({ name: "Gamer", slug: "" }).success).toBe(false);
    expect(updateCategoryRequestSchema.safeParse({}).success).toBe(false);
    expect(updateTagRequestSchema.safeParse({ status: "INACTIVE" }).success).toBe(true);
  });

  it("validates paginated responses and classification query bounds", () => {
    const page = { items: [{ ...baseRecord, description: "Accesorios" }], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };
    expect(categoryPageSchema.safeParse(page).success).toBe(true);
    expect(tagPageSchema.safeParse({ ...page, items: [baseRecord] }).success).toBe(true);
    expect(categoryPageSchema.safeParse({ ...page, items: [{ ...baseRecord }] }).success).toBe(false);
    expect(classificationListQuerySchema.safeParse({ page: 1, pageSize: 20, sortBy: "name", sortOrder: "asc", view: "public" }).success).toBe(true);
    expect(classificationListQuerySchema.safeParse({ page: 1, pageSize: 101, sortBy: "name", sortOrder: "asc" }).success).toBe(false);
  });
});
