import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z
    .string()
    .trim()
    .min(1)
    .startsWith("postgresql://", "DATABASE_URL must use the postgresql:// scheme"),
});

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
