import { createApiClient } from "@technology-ecommerce/api-client";
import { storeProfileSchema, type StoreProfile } from "@technology-ecommerce/api-schemas";
import type { paths } from "@technology-ecommerce/api-client";
import { z } from "zod";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});
export type StoreProfilePatch = paths["/api/v1/store-profile"]["patch"]["requestBody"]["content"]["application/json"];
const errorCodeSchema = z.object({ code: z.string() });

export class StoreProfileApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
      : status === 403 ? "Tu rol no permite modificar el perfil empresarial."
        : status === 404 ? "Aún no se ha configurado el perfil empresarial."
          : "No pudimos completar la operación. Inténtalo nuevamente.");
    this.name = "StoreProfileApiError";
  }
}

function failure(result: { error?: unknown; response: Response }): StoreProfileApiError {
  const parsed = errorCodeSchema.safeParse(result.error);
  return new StoreProfileApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
}

export async function getStoreProfile(accessToken: string, signal?: AbortSignal): Promise<StoreProfile | null> {
  const result = await client.GET("/api/v1/store-profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal,
  });
  if (result.response.status === 404) return null;
  if (!result.data) throw failure(result);
  return storeProfileSchema.parse(result.data);
}

export async function saveStoreProfile(accessToken: string, input: StoreProfilePatch): Promise<StoreProfile> {
  const result = await client.PATCH("/api/v1/store-profile", {
    body: input,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!result.data) throw failure(result);
  return storeProfileSchema.parse(result.data);
}
