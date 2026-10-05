import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BillingInvoicingModule } from "./billing-invoicing/billing-invoicing.module.js";
import { AuditObservabilityModule } from "./audit-observability/audit-observability.module.js";
import { validateEnvironment } from "./config/environment.js";
import { DatabaseModule } from "./database/database.module.js";
import { DocumentExportModule } from "./document-export/document-export.module.js";
import { HealthModule } from "./health/health.module.js";
import { DashboardModule } from "./dashboard/dashboard.module.js";
import { AuthModule } from "./identity-access/auth.module.js";
import { InventoryControlModule } from "./inventory-control/inventory-control.module.js";
import { ProductCatalogModule } from "./product-catalog/product-catalog.module.js";
import { ShoppingCartCheckoutModule } from "./shopping-cart-checkout/shopping-cart-checkout.module.js";
import { InternalJobsModule } from "./internal-jobs/internal-jobs.controller.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AuditObservabilityModule,
    DatabaseModule,
    DocumentExportModule,
    AuthModule,
    BillingInvoicingModule,
    InventoryControlModule,
    ProductCatalogModule,
    ShoppingCartCheckoutModule,
    HealthModule,
    DashboardModule,
    InternalJobsModule,
  ],
  exports: [AuthModule],
})
export class AppModule {}
