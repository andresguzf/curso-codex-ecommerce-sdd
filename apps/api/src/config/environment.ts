import { z } from "zod";

const DEVELOPMENT_ACCESS_TOKEN_SECRET =
  "development-only-access-token-secret-change-before-production";
const DEVELOPMENT_ALLOWED_ORIGINS =
  "http://localhost:3000,http://localhost:3001";

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
    DATABASE_URL: z
      .string()
      .trim()
      .min(1)
      .startsWith(
        "postgresql://",
        "DATABASE_URL must use the postgresql:// scheme",
      ),
    AUTH_ACCESS_TOKEN_SECRET: z.string().min(32).optional(),
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
  })
  .superRefine((environment, context) => {
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
