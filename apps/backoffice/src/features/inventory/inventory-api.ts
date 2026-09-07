import { createApiClient } from "@technology-ecommerce/api-client";
import {
  inventoryAdjustmentResponseSchema,
  inventoryMovementPageSchema,
  type InventoryAdjustmentRequest,
  type InventoryAdjustmentResponse,
  type InventoryMovementPage,
} from "@technology-ecommerce/api-schemas";

const client = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  credentials: "include",
});

export class InventoryApiError extends Error {
  constructor(readonly status: number) {
    super(
      status === 409
        ? "El ajuste dejaría el stock en un estado inválido. Revisa la cantidad disponible."
        : status === 403
          ? "No tienes permisos para gestionar inventario."
          : "No pudimos completar la operación de inventario.",
    );
    this.name = "InventoryApiError";
  }
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function adjustInventory(
  accessToken: string,
  productId: string,
  input: InventoryAdjustmentRequest,
): Promise<InventoryAdjustmentResponse> {
  const result = await client.POST("/api/v1/inventory/{productId}/adjustments", {
    body: input,
    headers: authorization(accessToken),
    params: { path: { productId } },
  });
  if (!result.data) throw new InventoryApiError(result.response.status);
  return inventoryAdjustmentResponseSchema.parse(result.data);
}

export async function listInventoryMovements(
  accessToken: string,
  productId: string,
  page: number,
): Promise<InventoryMovementPage> {
  const result = await client.GET("/api/v1/inventory/{productId}/movements", {
    headers: authorization(accessToken),
    params: { path: { productId }, query: { page, pageSize: 10 } },
  });
  if (!result.data) throw new InventoryApiError(result.response.status);
  return inventoryMovementPageSchema.parse(result.data);
}
