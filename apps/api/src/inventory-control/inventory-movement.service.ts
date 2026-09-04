import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { InventoryMovementRepository } from "./inventory-movement.repository";
import type { InventoryMovementPage } from "./inventory-movement.types";

@Injectable()
export class InventoryMovementService {
  constructor(
    @Inject(InventoryMovementRepository)
    private readonly repository: InventoryMovementRepository,
  ) {}

  async listByProduct(
    productId: string,
    page: number,
    pageSize: number,
  ): Promise<InventoryMovementPage> {
    const result = await this.repository.listByProduct(productId, page, pageSize);
    if (!result) {
      throw new NotFoundException({
        code: "PRODUCT_NOT_FOUND",
        message: "The requested product does not exist",
      });
    }
    return result;
  }
}
