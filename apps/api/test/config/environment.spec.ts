import { describe, expect, it } from "vitest";

import { validateEnvironment } from "../../src/config/environment";

const databaseUrl = "postgresql://postgres:password@localhost:5432/ecommerce";
const productionSecret = "production-test-secret-at-least-32-characters";

describe("HTTP security environment", () => {
  it("uses explicit local origins and non-secure cookies in development", () => {
    const environment = validateEnvironment({ DATABASE_URL: databaseUrl });

    expect(environment.AUTH_COOKIE_SECURE).toBe(false);
    expect(environment.AUTH_COOKIE_SAME_SITE).toBe("lax");
    expect(environment.CORS_ALLOWED_ORIGINS).toEqual([
      "http://localhost:3000",
      "http://localhost:3002",
    ]);
    expect(environment.IMAGE_STORAGE_MAX_BYTES).toBe(5 * 1_024 * 1_024);
    expect(environment.IMAGE_STORAGE_LOCAL_ROOT).toBe(".local-storage/images");
    expect(environment.SIMULATED_SHIPPING_PICKUP_COST).toBe("0.00");
    expect(environment.SIMULATED_SHIPPING_STANDARD_COST).toBe("5.00");
    expect(environment.SIMULATED_SHIPPING_EXPRESS_COST).toBe("15.00");
  });

  it("validates image storage limits and public URLs", () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        IMAGE_STORAGE_MAX_BYTES: "100",
      }),
    ).toThrow("IMAGE_STORAGE_MAX_BYTES");
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        IMAGE_STORAGE_PUBLIC_BASE_URL: "not-a-url",
      }),
    ).toThrow("IMAGE_STORAGE_PUBLIC_BASE_URL");
  });

  it("normalizes and validates simulated shipping costs", () => {
    const environment = validateEnvironment({
      DATABASE_URL: databaseUrl,
      SIMULATED_SHIPPING_EXPRESS_COST: "20.5",
      SIMULATED_SHIPPING_PICKUP_COST: "0",
      SIMULATED_SHIPPING_STANDARD_COST: "7.25",
    });

    expect(environment.SIMULATED_SHIPPING_EXPRESS_COST).toBe("20.50");
    expect(environment.SIMULATED_SHIPPING_PICKUP_COST).toBe("0.00");
    expect(environment.SIMULATED_SHIPPING_STANDARD_COST).toBe("7.25");
    expect(() =>
      validateEnvironment({
        DATABASE_URL: databaseUrl,
        SIMULATED_SHIPPING_STANDARD_COST: "7.255",
      }),
    ).toThrow("SIMULATED_SHIPPING_STANDARD_COST");
  });

  it("defaults to secure cookies and rejects an explicit downgrade in production", () => {
    expect(
      validateEnvironment({
        AUTH_ACCESS_TOKEN_SECRET: productionSecret,
        DATABASE_URL: databaseUrl,
        NODE_ENV: "production",
      }).AUTH_COOKIE_SECURE,
    ).toBe(true);
    expect(() =>
      validateEnvironment({
        AUTH_ACCESS_TOKEN_SECRET: productionSecret,
        AUTH_COOKIE_SECURE: "false",
        DATABASE_URL: databaseUrl,
        NODE_ENV: "production",
      }),
    ).toThrow("AUTH_COOKIE_SECURE must be true in production");
  });

  it("rejects invalid origins and insecure SameSite=None cookies", () => {
    expect(() =>
      validateEnvironment({
        CORS_ALLOWED_ORIGINS: "https://storefront.example.com/path",
        DATABASE_URL: databaseUrl,
      }),
    ).toThrow("Invalid allowed origin");
    expect(() =>
      validateEnvironment({
        AUTH_COOKIE_SAME_SITE: "none",
        AUTH_COOKIE_SECURE: "false",
        DATABASE_URL: databaseUrl,
      }),
    ).toThrow("SameSite=None cookies require AUTH_COOKIE_SECURE=true");
  });
});
