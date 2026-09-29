import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { InventoryAdjustmentController } from "./inventory-adjustment.controller";
import { InventoryAdjustmentRepository } from "./inventory-adjustment.repository";
import { InventoryAdjustmentService } from "./inventory-adjustment.service";
import { InventoryBalanceController } from "./inventory-balance.controller";
import { InventoryBalanceRepository } from "./inventory-balance.repository";
import { InventoryBalanceService } from "./inventory-balance.service";
import { InventoryMovementController } from "./inventory-movement.controller";
import { InventoryMovementRepository } from "./inventory-movement.repository";
import { InventoryMovementService } from "./inventory-movement.service";
import { InventoryStockRepository } from "./inventory-stock.repository";
import { InventoryStockService } from "./inventory-stock.service";

@Module({
  controllers: [InventoryAdjustmentController, InventoryBalanceController, InventoryMovementController],
  imports: [AuthModule],
  exports: [InventoryStockService],
  providers: [
    InventoryAdjustmentRepository,
    InventoryAdjustmentService,
    InventoryBalanceRepository,
    InventoryBalanceService,
    InventoryMovementRepository,
    InventoryMovementService,
    InventoryStockRepository,
    InventoryStockService,
  ],
})
export class InventoryControlModule {}
