import { Module } from "@nestjs/common";
import { AuthModule } from "../identity-access/auth.module.js";
import { ProductCatalogModule } from "../product-catalog/product-catalog.module.js";
import { InventoryControlModule } from "../inventory-control/inventory-control.module.js";
import { OrderManagementModule } from "../order-management/order-management.module.js";
import { BillingInvoicingModule } from "../billing-invoicing/billing-invoicing.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardSummaryService } from "./dashboard-summary.service.js";

@Module({
  imports: [AuthModule, ProductCatalogModule, InventoryControlModule, OrderManagementModule, BillingInvoicingModule],
  controllers: [DashboardController],
  providers: [DashboardSummaryService],
})
export class DashboardModule {}
