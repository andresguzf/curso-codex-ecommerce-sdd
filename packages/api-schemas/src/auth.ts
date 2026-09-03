import { z } from "zod";

export const authRoleSchema = z.enum(["CUSTOMER", "ADMIN", "BILLING"]);

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Ingresa un correo electrónico válido.")
    .max(320, "El correo es demasiado largo."),
  password: z
    .string()
    .min(1, "Ingresa tu contraseña.")
    .max(1_024, "La contraseña es demasiado larga."),
});

export const registerRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Ingresa un correo electrónico válido.")
      .max(320, "El correo es demasiado largo."),
    displayName: z
      .string()
      .trim()
      .min(2, "Ingresa al menos 2 caracteres.")
      .max(120, "El nombre es demasiado largo."),
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .max(128, "La contraseña es demasiado larga."),
  })
  .strict();

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().trim().min(1),
  role: authRoleSchema,
});

export const authSessionSchema = z.object({
  accessToken: z.string().trim().min(1),
  tokenType: z.literal("Bearer"),
  accessTokenExpiresAt: z.iso.datetime({ offset: true }),
  sessionExpiresAt: z.iso.datetime({ offset: true }),
  user: authenticatedUserSchema,
});

export const csrfTokenResponseSchema = z.object({
  csrfToken: z.string().min(32),
});

export type AuthRole = z.infer<typeof authRoleSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;
export type CsrfTokenResponse = z.infer<typeof csrfTokenResponseSchema>;
