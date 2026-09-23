import { createApiClient } from "@technology-ecommerce/api-client";
import {
  administrativeUserSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  userPageSchema,
  type AdministrativeUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserListQuery,
  type UserPage,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

const errorCodeSchema = z.object({ code: z.string() });

export class UserApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(
      status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
        : status === 403 ? "Tu rol no permite administrar usuarios."
          : code === "USER_LAST_ACTIVE_ADMIN" ? "No se puede desactivar o eliminar al último administrador activo."
            : code === "USER_EMAIL_ALREADY_REGISTERED" ? "Ya existe una cuenta con ese correo."
              : status === 404 ? "No encontramos el usuario solicitado."
                : "No pudimos completar la operación. Inténtalo nuevamente.",
    );
    this.name = "UserApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function failure(result: { error?: unknown; response: Response }): UserApiError {
  const parsed = errorCodeSchema.safeParse(result.error);
  return new UserApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
}

export async function listUsers(accessToken: string, query: UserListQuery, signal?: AbortSignal): Promise<UserPage> {
  const result = await client.GET("/api/v1/users", {
    headers: authorization(accessToken),
    params: { query },
    signal,
  });
  if (!result.data) throw failure(result);
  return userPageSchema.parse(result.data);
}

export async function createUser(accessToken: string, input: CreateUserRequest): Promise<AdministrativeUser> {
  const result = await client.POST("/api/v1/users", {
    body: { ...createUserRequestSchema.parse(input), status: input.status ?? "ACTIVE" },
    headers: authorization(accessToken),
  });
  if (!result.data) throw failure(result);
  return administrativeUserSchema.parse(result.data);
}

export async function updateUser(accessToken: string, userId: string, input: UpdateUserRequest): Promise<AdministrativeUser> {
  const result = await client.PATCH("/api/v1/users/{userId}", {
    body: updateUserRequestSchema.parse(input),
    headers: authorization(accessToken),
    params: { path: { userId } },
  });
  if (!result.data) throw failure(result);
  return administrativeUserSchema.parse(result.data);
}

export async function deleteUser(accessToken: string, userId: string): Promise<void> {
  const result = await client.DELETE("/api/v1/users/{userId}", {
    headers: authorization(accessToken),
    params: { path: { userId } },
  });
  if (!result.response.ok) throw failure(result);
}
