import { createApiClient } from "@technology-ecommerce/api-client";
import {
  categoryPageSchema,
  categorySchema,
  tagPageSchema,
  tagSchema,
  type Category,
  type ClassificationListQuery,
  type Tag,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

export type ClassificationKind = "categories" | "tags";
export type ClassificationRecord = Category | Tag;
export type ClassificationInput = Readonly<{ name: string; slug?: string; description?: string; status?: "ACTIVE" | "INACTIVE" }>;

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});
const errorCodeSchema = z.object({ code: z.string() });

export class ClassificationApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(
      status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
        : status === 403 ? "Tu rol no puede administrar el catálogo."
          : code === "CLASSIFICATION_NAME_ALREADY_EXISTS" ? "Ya existe un registro con ese nombre."
            : code === "CLASSIFICATION_SLUG_ALREADY_EXISTS" ? "Ese slug ya está en uso."
              : code === "CLASSIFICATION_SLUG_INVALID" ? "El slug no es válido."
                : status === 404 ? "El registro ya no está disponible. Actualiza la lista."
                  : "No pudimos completar la operación. Inténtalo nuevamente.",
    );
    this.name = "ClassificationApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

function failure(result: { error?: unknown; response: Response }): ClassificationApiError {
  const parsed = errorCodeSchema.safeParse(result.error);
  return new ClassificationApiError(result.response.status, parsed.success ? parsed.data.code : undefined);
}

export async function listClassifications(
  kind: "categories",
  accessToken: string,
  query: ClassificationListQuery,
  signal?: AbortSignal,
): Promise<z.infer<typeof categoryPageSchema>>;
export async function listClassifications(
  kind: "tags",
  accessToken: string,
  query: ClassificationListQuery,
  signal?: AbortSignal,
): Promise<z.infer<typeof tagPageSchema>>;
export async function listClassifications(
  kind: ClassificationKind,
  accessToken: string,
  query: ClassificationListQuery,
  signal?: AbortSignal,
): Promise<z.infer<typeof categoryPageSchema> | z.infer<typeof tagPageSchema>>;
export async function listClassifications(
  kind: ClassificationKind,
  accessToken: string,
  query: ClassificationListQuery,
  signal?: AbortSignal,
): Promise<z.infer<typeof categoryPageSchema> | z.infer<typeof tagPageSchema>> {
  const params = { query: { ...query, view: "administrative" as const } };
  if (kind === "categories") {
    const result = await client.GET("/api/v1/categories", { headers: authorization(accessToken), params, signal });
    if (!result.data) throw failure(result);
    return categoryPageSchema.parse(result.data);
  }
  const result = await client.GET("/api/v1/tags", { headers: authorization(accessToken), params, signal });
  if (!result.data) throw failure(result);
  return tagPageSchema.parse(result.data);
}

export function listAllAdministrativeClassifications(
  kind: "categories",
  accessToken: string,
  signal?: AbortSignal,
): Promise<Category[]>;
export function listAllAdministrativeClassifications(
  kind: "tags",
  accessToken: string,
  signal?: AbortSignal,
): Promise<Tag[]>;
export function listAllAdministrativeClassifications(
  kind: ClassificationKind,
  accessToken: string,
  signal?: AbortSignal,
): Promise<ClassificationRecord[]>;
export async function listAllAdministrativeClassifications(
  kind: ClassificationKind,
  accessToken: string,
  signal?: AbortSignal,
): Promise<ClassificationRecord[]> {
  const records: ClassificationRecord[] = [];
  for (let page = 1; ; page += 1) {
    const result = await listClassifications(kind, accessToken, {
      page,
      pageSize: 100,
      sortBy: "name",
      sortOrder: "asc",
      view: "administrative",
    }, signal);
    records.push(...result.items);
    if (page >= result.totalPages) return records;
  }
}

export async function createClassification(kind: ClassificationKind, accessToken: string, input: ClassificationInput): Promise<ClassificationRecord> {
  if (kind === "categories") {
    const result = await client.POST("/api/v1/categories", { headers: authorization(accessToken), body: { name: input.name, ...(input.slug ? { slug: input.slug } : {}), description: input.description ?? "", status: input.status ?? "ACTIVE" } });
    if (!result.data) throw failure(result);
    return categorySchema.parse(result.data);
  }
  const result = await client.POST("/api/v1/tags", { headers: authorization(accessToken), body: { name: input.name, ...(input.slug ? { slug: input.slug } : {}), status: input.status ?? "ACTIVE" } });
  if (!result.data) throw failure(result);
  return tagSchema.parse(result.data);
}

export async function updateClassification(kind: ClassificationKind, accessToken: string, id: string, input: Partial<ClassificationInput>): Promise<ClassificationRecord> {
  if (kind === "categories") {
    const result = await client.PATCH("/api/v1/categories/{categoryId}", { headers: authorization(accessToken), params: { path: { categoryId: id } }, body: input });
    if (!result.data) throw failure(result);
    return categorySchema.parse(result.data);
  }
  const result = await client.PATCH("/api/v1/tags/{tagId}", { headers: authorization(accessToken), params: { path: { tagId: id } }, body: { ...(input.name === undefined ? {} : { name: input.name }), ...(input.slug ? { slug: input.slug } : {}), ...(input.status ? { status: input.status } : {}) } });
  if (!result.data) throw failure(result);
  return tagSchema.parse(result.data);
}

export async function deleteClassification(kind: ClassificationKind, accessToken: string, id: string): Promise<void> {
  const result = kind === "categories"
    ? await client.DELETE("/api/v1/categories/{categoryId}", { headers: authorization(accessToken), params: { path: { categoryId: id } } })
    : await client.DELETE("/api/v1/tags/{tagId}", { headers: authorization(accessToken), params: { path: { tagId: id } } });
  if (!result.response.ok) throw failure(result);
}
