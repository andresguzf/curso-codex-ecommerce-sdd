import { describe, expect, it } from "vitest";

import {
  authenticatedUserSchema,
  authSessionSchema,
  csrfTokenResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
} from "../src";

const user = {
  id: "8f0f36e0-3339-4c34-b1ae-2e7ef90f2060",
  email: "customer@example.com",
  displayName: "Example customer",
  role: "CUSTOMER",
} as const;

describe("authentication HTTP schemas", () => {
  it("accepts the documented login and session responses", () => {
    expect(
      loginRequestSchema.safeParse({
        email: user.email,
        password: "a-strong-password",
      }).success,
    ).toBe(true);
    expect(
      authSessionSchema.safeParse({
        accessToken: "signed-access-token",
        tokenType: "Bearer",
        accessTokenExpiresAt: "2026-09-02T20:00:00.000Z",
        sessionExpiresAt: "2026-09-09T20:00:00.000Z",
        user,
      }).success,
    ).toBe(true);
    expect(
      csrfTokenResponseSchema.safeParse({ csrfToken: "x".repeat(43) }).success,
    ).toBe(true);
  });

  it("rejects unsupported roles and malformed session data", () => {
    expect(
      registerRequestSchema.safeParse({
        email: "attacker@example.com",
        displayName: "Attempted administrator",
        password: "StrongPassword123!",
        role: "ADMIN",
      }).success,
    ).toBe(false);
    expect(
      authenticatedUserSchema.safeParse({ ...user, role: "OWNER" }).success,
    ).toBe(false);
    expect(
      authSessionSchema.safeParse({
        accessToken: "",
        tokenType: "Basic",
        accessTokenExpiresAt: "not-a-date",
        sessionExpiresAt: "2026-09-09T20:00:00.000Z",
        user,
      }).success,
    ).toBe(false);
  });
});
