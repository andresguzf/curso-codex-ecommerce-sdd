import { z } from "zod";

import { databaseConnectionOptions } from "../database/connection-options";

export const CATALOG_IMAGE_FOLDER = "codex-storefront";

const optionalPrivateString = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const DEVELOPMENT_ACCESS_TOKEN_SECRET =
  "development-only-access-token-secret-change-before-production";
const DEVELOPMENT_ALLOWED_ORIGINS =
  "http://localhost:3000,http://localhost:3002";

const fixedMoneySchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/)
  .transform((value) => {
    const [majorUnits, decimalUnits = ""] = value.split(".");
    return `${majorUnits}.${decimalUnits.padEnd(2, "0")}`;
  });

const allowedOriginsSchema = z
  .string()
  .trim()
  .min(1)
  .default(DEVELOPMENT_ALLOWED_ORIGINS)
  .transform((value, context) => {
    const origins = [...new Set(value.split(",").map((origin) => origin.trim()))];

    for (const origin of origins) {
      try {
        const parsed = new URL(origin);

        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.origin !== origin
        ) {
          throw new Error("Origin must contain only scheme, host, and port");
        }
      } catch {
        context.addIssue({
          code: "custom",
          message: `Invalid allowed origin: ${origin}`,
        });
      }
    }

    return origins;
  });

const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().trim().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
    VERCEL: z.enum(["0", "1"]).optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    CRON_SECRET: optionalPrivateString,
    DATABASE_URL: z
      .string()
      .trim()
      .min(1)
      .startsWith(
        "postgresql://",
        "DATABASE_URL must use the postgresql:// scheme",
      ),
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
    DATABASE_TLS_VERIFY_SERVER: z.enum(["true", "false"]).default("true")
      .transform((value) => value === "true"),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3_600)
      .default(900),
    AUTH_REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(2)
      .max(2_592_000)
      .default(604_800),
    AUTH_COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_LOGIN_MAX_ATTEMPTS: z.coerce
      .number()
      .int()
      .min(2)
      .max(100)
      .default(5),
    AUTH_LOGIN_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(86_400)
      .default(900),
    CORS_ALLOWED_ORIGINS: allowedOriginsSchema,
    CART_ANONYMOUS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(31_536_000)
      .default(2_592_000),
    IMAGE_STORAGE_LOCAL_ROOT: z
      .string()
      .trim()
      .min(1)
      .default(".local-storage/images"),
    IMAGE_STORAGE_CATALOG_PROVIDER: z.enum(["local", "cloudinary"]).default("local"),
    CLOUDINARY_CLOUD_NAME: optionalPrivateString,
    CLOUDINARY_API_KEY: optionalPrivateString,
    CLOUDINARY_API_SECRET: optionalPrivateString,
    CLOUDINARY_FOLDER_MODE: z.preprocess(
      (value) => value === "" ? undefined : value,
      z.enum(["dynamic", "fixed"]).optional(),
    ),
    IMAGE_STORAGE_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(20 * 1_024 * 1_024)
      .default(5 * 1_024 * 1_024),
    IMAGE_STORAGE_PUBLIC_BASE_URL: z
      .string()
      .trim()
      .url()
      .default("http://localhost:3001/api/v1/media/images"),
    SIMULATED_SHIPPING_PICKUP_COST: fixedMoneySchema.default("0.00"),
    SIMULATED_SHIPPING_STANDARD_COST: fixedMoneySchema.default("5.00"),
    SIMULATED_SHIPPING_EXPRESS_COST: fixedMoneySchema.default("15.00"),
  })
  .superRefine((environment, context) => {
    if (environment.VERCEL === "1" && environment.IMAGE_STORAGE_CATALOG_PROVIDER !== "cloudinary") {
      context.addIssue({ code: "custom", path: ["IMAGE_STORAGE_CATALOG_PROVIDER"], message: "Vercel catalog uploads require Cloudinary; local disk is not durable" });
    }
    if (environment.VERCEL === "1" && environment.VERCEL_ENV === "production" && (!environment.CRON_SECRET || environment.CRON_SECRET.length < 32)) {
      context.addIssue({ code: "custom", path: ["CRON_SECRET"], message: "A private CRON_SECRET of at least 32 characters is required on Vercel production" });
    }
    try {
      databaseConnectionOptions(environment.DATABASE_URL, environment.DATABASE_TLS_VERIFY_SERVER);
    } catch (error) {
      context.addIssue({ code: "custom", path: ["DATABASE_URL"],
        message: error instanceof Error ? error.message : "Invalid database connection configuration" });
    }
    if (environment.IMAGE_STORAGE_CATALOG_PROVIDER === "cloudinary") {
      for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER_MODE"] as const) {
        if (!environment[key]) {
          context.addIssue({ code: "custom", path: [key], message: `${key} is required for Cloudinary catalog storage` });
        }
      }
    }
    if (
      environment.NODE_ENV === "production" &&
      !environment.AUTH_ACCESS_TOKEN_SECRET
    ) {
      context.addIssue({
        code: "custom",
        message: "AUTH_ACCESS_TOKEN_SECRET is required in production",
        path: ["AUTH_ACCESS_TOKEN_SECRET"],
      });
    }

    if (
      environment.AUTH_REFRESH_TOKEN_TTL_SECONDS <=
      environment.AUTH_ACCESS_TOKEN_TTL_SECONDS
    ) {
      context.addIssue({
        code: "custom",
        message:
          "AUTH_REFRESH_TOKEN_TTL_SECONDS must be greater than AUTH_ACCESS_TOKEN_TTL_SECONDS",
        path: ["AUTH_REFRESH_TOKEN_TTL_SECONDS"],
      });
    }

    const cookieIsSecure =
      environment.AUTH_COOKIE_SECURE === undefined
        ? environment.NODE_ENV === "production"
        : environment.AUTH_COOKIE_SECURE === "true";

    if (environment.NODE_ENV === "production" && !cookieIsSecure) {
      context.addIssue({
        code: "custom",
        message: "AUTH_COOKIE_SECURE must be true in production",
        path: ["AUTH_COOKIE_SECURE"],
      });
    }

    if (environment.AUTH_COOKIE_SAME_SITE === "none" && !cookieIsSecure) {
      context.addIssue({
        code: "custom",
        message: "SameSite=None cookies require AUTH_COOKIE_SECURE=true",
        path: ["AUTH_COOKIE_SAME_SITE"],
      });
    }
  })
  .transform((environment) => ({
    ...environment,
    IMAGE_STORAGE_MAX_BYTES: environment.VERCEL === "1" ? Math.min(environment.IMAGE_STORAGE_MAX_BYTES, 4 * 1_024 * 1_024) : environment.IMAGE_STORAGE_MAX_BYTES,
    AUTH_ACCESS_TOKEN_SECRET:
      environment.AUTH_ACCESS_TOKEN_SECRET ?? DEVELOPMENT_ACCESS_TOKEN_SECRET,
    AUTH_COOKIE_SECURE:
      environment.AUTH_COOKIE_SECURE === undefined
        ? environment.NODE_ENV === "production"
        : environment.AUTH_COOKIE_SECURE === "true",
  }));

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    throw new Error(`Environment validation failed:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
