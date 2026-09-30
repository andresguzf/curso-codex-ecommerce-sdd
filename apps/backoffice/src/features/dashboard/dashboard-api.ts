import { createApiClient } from "@technology-ecommerce/api-client";
import { dashboardSummarySchema, type DashboardSummary } from "@technology-ecommerce/api-schemas";

export type DashboardRole = "ADMIN" | "BILLING";
const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class DashboardApiError extends Error {
  constructor(readonly status: number) {
    super(status === 401 ? "Tu sesión venció. Inicia sesión nuevamente."
      : status === 403 ? "Tu rol no permite consultar este resumen."
        : "No pudimos cargar el resumen. Vuelve a intentarlo.");
    this.name = "DashboardApiError";
  }
}

export async function getDashboardSummary(accessToken: string, role: DashboardRole, signal?: AbortSignal): Promise<DashboardSummary> {
  const timeout = AbortSignal.timeout(10_000);
  const result = await client.GET("/api/v1/dashboard/summary", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!result.data) throw new DashboardApiError(result.response.status);
  const parsed = dashboardSummarySchema.safeParse(result.data);
  if (!parsed.success || parsed.data.role !== role) throw new DashboardApiError(502);
  return parsed.data;
}
