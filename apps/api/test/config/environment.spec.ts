import { describe, expect, it } from "vitest";

import { CATALOG_IMAGE_FOLDER, validateEnvironment } from "../../src/config/environment.js";

const databaseUrl = "postgresql://postgres:password@localhost:5432/ecommerce";
const productionSecret = "production-test-secret-at-least-32-characters";

describe("HTTP security environment", () => {
  const vercelConfig = {
    DATABASE_URL: databaseUrl, VERCEL: "1", VERCEL_ENV: "production",
    AUTH_ACCESS_TOKEN_SECRET: productionSecret,
    CRON_SECRET: "test-cron-secret-of-at-least-32-characters",
    IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary", CLOUDINARY_FOLDER_MODE: "dynamic",
    CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret",
  };
  it("caps Vercel binary uploads at 4 MiB while retaining smaller limits", () => {
    expect(validateEnvironment(vercelConfig).IMAGE_STORAGE_MAX_BYTES).toBe(4 * 1024 * 1024);
    expect(validateEnvironment({ ...vercelConfig, IMAGE_STORAGE_MAX_BYTES: 2048 }).IMAGE_STORAGE_MAX_BYTES).toBe(2048);
  });
  it("rejects mutable local storage and missing production cron credentials on Vercel", () => {
    expect(() => validateEnvironment({ ...vercelConfig, IMAGE_STORAGE_CATALOG_PROVIDER: "local" })).toThrow("local disk is not durable");
    expect(() => validateEnvironment({ ...vercelConfig, CRON_SECRET: "" })).toThrow("CRON_SECRET");
    expect(() => validateEnvironment({ ...vercelConfig, VERCEL_ENV: "preview", CRON_SECRET: "" })).not.toThrow();
  });
  it("keeps catalog local by default and fixes the Cloudinary destination", () => {
    const environment = validateEnvironment({ DATABASE_URL: databaseUrl });
    expect(environment.IMAGE_STORAGE_CATALOG_PROVIDER).toBe("local");
    expect(CATALOG_IMAGE_FOLDER).toBe("codex-storefront");
    expect(environment.CLOUDINARY_FOLDER_MODE).toBeUndefined();
  });

  it("allows private preparation without activating Cloudinary", () => {
    const environment = validateEnvironment({
      DATABASE_URL: databaseUrl,
      CLOUDINARY_CLOUD_NAME: "development-cloud",
      CLOUDINARY_API_KEY: "test-key-not-real",
      CLOUDINARY_API_SECRET: "test-secret-not-real",
      CLOUDINARY_FOLDER_MODE: "",
    });
    expect(environment.IMAGE_STORAGE_CATALOG_PROVIDER).toBe("local");
    expect(environment.CLOUDINARY_FOLDER_MODE).toBeUndefined();
    expect(() => validateEnvironment({
      DATABASE_URL: databaseUrl,
      CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
    })).not.toThrow();
  });

  it.each(["dynamic", "fixed"])("accepts explicit %s mode with complete private configuration", (mode) => {
    expect(validateEnvironment({
      DATABASE_URL: databaseUrl,
      IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "development-cloud",
      CLOUDINARY_API_KEY: "test-key-not-real",
      CLOUDINARY_API_SECRET: "test-secret-not-real",
      CLOUDINARY_FOLDER_MODE: mode,
    }).CLOUDINARY_FOLDER_MODE).toBe(mode);
  });

  it.each(["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER_MODE"])("requires %s when Cloudinary is selected without leaking values", (missing) => {
    const config = {
      DATABASE_URL: databaseUrl,
      IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "development-cloud",
      CLOUDINARY_API_KEY: "private-key-sentinel",
      CLOUDINARY_API_SECRET: "private-secret-sentinel",
      CLOUDINARY_FOLDER_MODE: "dynamic",
      [missing]: " ",
    };
    let message = "";
    try { validateEnvironment(config); } catch (error) { message = (error as Error).message; }
    expect(message).toContain(missing);
    expect(message).not.toContain("private-key-sentinel");
    expect(message).not.toContain("private-secret-sentinel");
  });

  it("rejects unsupported providers and folder modes", () => {
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl, IMAGE_STORAGE_CATALOG_PROVIDER: "other" })).toThrow("IMAGE_STORAGE_CATALOG_PROVIDER");
    expect(() => validateEnvironment({ DATABASE_URL: databaseUrl, CLOUDINARY_FOLDER_MODE: "guess" })).toThrow("CLOUDINARY_FOLDER_MODE");
  });

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
