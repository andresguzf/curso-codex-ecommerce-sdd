import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module.js";
import { InventorySummaryReader } from "./inventory-summary.reader.js";
import { InventoryAdjustmentController } from "./inventory-adjustment.controller.js";
import { InventoryAdjustmentRepository } from "./inventory-adjustment.repository.js";
import { InventoryAdjustmentService } from "./inventory-adjustment.service.js";
import { InventoryBalanceController } from "./inventory-balance.controller.js";
import { InventoryBalanceRepository } from "./inventory-balance.repository.js";
import { InventoryBalanceService } from "./inventory-balance.service.js";
import { InventoryMovementController } from "./inventory-movement.controller.js";
import { InventoryMovementRepository } from "./inventory-movement.repository.js";
import { InventoryMovementService } from "./inventory-movement.service.js";
import { InventoryStockRepository } from "./inventory-stock.repository.js";
import { InventoryStockService } from "./inventory-stock.service.js";

@Module({
  controllers: [InventoryAdjustmentController, InventoryBalanceController, InventoryMovementController],
  imports: [AuthModule],
  exports: [InventoryStockService, InventorySummaryReader],
  providers: [
    InventorySummaryReader,
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
