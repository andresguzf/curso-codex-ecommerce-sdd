import { describe, expect, it } from "vitest";

import {
  createUserRequestSchema,
  updateUserRequestSchema,
  userListQuerySchema,
  userPageSchema,
} from "../src";

const user = {
  id: "8f0f36e0-3339-4c34-b1ae-2e7ef90f2060",
  email: "billing@example.com",
  displayName: "Billing operator",
  role: "BILLING",
  status: "ACTIVE",
  createdAt: "2026-09-02T20:00:00.000Z",
  updatedAt: "2026-09-02T20:00:00.000Z",
  deletedAt: null,
} as const;

describe("user administration HTTP schemas", () => {
  it("accepts documented requests and paginated responses", () => {
    expect(
      createUserRequestSchema.safeParse({
        email: user.email,
        displayName: user.displayName,
        password: "StrongPassword123!",
        role: user.role,
      }).success,
    ).toBe(true);
    expect(
      updateUserRequestSchema.safeParse({ status: "INACTIVE" }).success,
    ).toBe(true);
    expect(
      userListQuerySchema.safeParse({ page: "2", pageSize: "10" }).success,
    ).toBe(true);
    expect(
      userPageSchema.safeParse({
        items: [user],
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      }).success,
    ).toBe(true);
  });

  it("rejects empty updates, unsupported roles and malformed pagination", () => {
    expect(updateUserRequestSchema.safeParse({}).success).toBe(false);
    expect(
      createUserRequestSchema.safeParse({
        email: user.email,
        displayName: user.displayName,
        password: "StrongPassword123!",
        role: "OWNER",
      }).success,
    ).toBe(false);
    expect(
      userPageSchema.safeParse({
        items: [user],
        page: 0,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      }).success,
    ).toBe(false);
  });
});
