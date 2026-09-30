import { Module } from "@nestjs/common";
import { AuthModule } from "../identity-access/auth.module";
import { ProductCatalogModule } from "../product-catalog/product-catalog.module";
import { InventoryControlModule } from "../inventory-control/inventory-control.module";
import { OrderManagementModule } from "../order-management/order-management.module";
import { BillingInvoicingModule } from "../billing-invoicing/billing-invoicing.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardSummaryService } from "./dashboard-summary.service";

@Module({
  imports: [AuthModule, ProductCatalogModule, InventoryControlModule, OrderManagementModule, BillingInvoicingModule],
  controllers: [DashboardController],
  providers: [DashboardSummaryService],
})
export class DashboardModule {}
