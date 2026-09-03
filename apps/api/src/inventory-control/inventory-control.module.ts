import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { InventoryAdjustmentController } from "./inventory-adjustment.controller";
import { InventoryAdjustmentRepository } from "./inventory-adjustment.repository";
import { InventoryAdjustmentService } from "./inventory-adjustment.service";
import { InventoryStockRepository } from "./inventory-stock.repository";
import { InventoryStockService } from "./inventory-stock.service";

@Module({
  controllers: [InventoryAdjustmentController],
  imports: [AuthModule],
  exports: [InventoryStockService],
  providers: [
    InventoryAdjustmentRepository,
    InventoryAdjustmentService,
    InventoryStockRepository,
    InventoryStockService,
  ],
})
export class InventoryControlModule {}
