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
