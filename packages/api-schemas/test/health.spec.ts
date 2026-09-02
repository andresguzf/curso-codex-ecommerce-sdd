import { describe, expect, it } from "vitest";

import { healthResponseSchema } from "../src";

describe("healthResponseSchema", () => {
  it("accepts the documented health response", () => {
    expect(
      healthResponseSchema.parse({
        status: "ok",
        service: "api",
        database: { status: "up", name: "ecommerce_backend_sdd" },
      }),
    ).toEqual({
      status: "ok",
      service: "api",
      database: { status: "up", name: "ecommerce_backend_sdd" },
    });
  });

  it("rejects an untrusted response with an invalid database status", () => {
    expect(
      healthResponseSchema.safeParse({
        status: "ok",
        service: "api",
        database: { status: "down", name: "ecommerce_backend_sdd" },
      }).success,
    ).toBe(false);
  });
});
