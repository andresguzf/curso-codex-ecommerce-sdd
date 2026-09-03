import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  InsufficientInventoryError,
  InventoryAdjustmentRepository,
  InventoryQuantityOverflowError,
} from "./inventory-adjustment.repository";
import type {
  InventoryAdjustmentInput,
  InventoryAdjustmentResult,
} from "./inventory-adjustment.types";

@Injectable()
export class InventoryAdjustmentService {
  constructor(
    @Inject(InventoryAdjustmentRepository)
    private readonly repository: InventoryAdjustmentRepository,
  ) {}

  async adjust(
    productId: string,
    input: InventoryAdjustmentInput,
    actorUserId: string,
  ): Promise<InventoryAdjustmentResult> {
    try {
      const result = await this.repository.adjust(
        productId,
        { ...input, reason: input.reason.trim() },
        actorUserId,
      );
      if (!result) {
        throw new NotFoundException({
          code: "PRODUCT_NOT_FOUND",
          message: "The requested product does not exist",
        });
      }
      return result;
    } catch (error) {
      if (error instanceof InsufficientInventoryError) {
        throw new ConflictException({
          code: "INVENTORY_INSUFFICIENT_STOCK",
          details: { availableQuantity: error.availableQuantity },
          message: "The adjustment would produce a negative inventory balance",
        });
      }
      if (error instanceof InventoryQuantityOverflowError) {
        throw new ConflictException({
          code: "INVENTORY_QUANTITY_OUT_OF_RANGE",
          message: "The adjusted inventory quantity exceeds the supported range",
        });
      }
      throw error;
    }
  }
}
