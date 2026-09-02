import { createApiClient } from "@technology-ecommerce/api-client";
import {
  healthResponseSchema,
  type HealthResponse,
} from "@technology-ecommerce/api-schemas";

const apiClient = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
});

export async function getApiHealth(): Promise<HealthResponse> {
  const { data, error } = await apiClient.GET("/api/v1/health");

  if (error || !data) {
    throw new Error("The API health request failed");
  }

  return healthResponseSchema.parse(data);
}
