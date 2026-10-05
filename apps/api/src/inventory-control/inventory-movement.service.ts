import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { InventoryMovementRepository } from "./inventory-movement.repository.js";
import type { InventoryMovementPage, InventoryMovementQuery } from "./inventory-movement.types.js";

@Injectable()
export class InventoryMovementService {
  constructor(
    @Inject(InventoryMovementRepository)
    private readonly repository: InventoryMovementRepository,
  ) {}

  async listByProduct(
    productId: string,
    query: InventoryMovementQuery,
  ): Promise<InventoryMovementPage> {
    const result = await this.repository.listByProduct(productId, query);
    if (!result) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "The requested product does not exist",
      });
    }
    return result;
  }
}
