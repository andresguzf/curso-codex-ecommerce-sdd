import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { BillingInvoicingModule } from "./billing-invoicing/billing-invoicing.module";
import { validateEnvironment } from "./config/environment";
import { DatabaseModule } from "./database/database.module";
import { DocumentExportModule } from "./document-export/document-export.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./identity-access/auth.module";
import { InventoryControlModule } from "./inventory-control/inventory-control.module";
import { ProductCatalogModule } from "./product-catalog/product-catalog.module";
import { ShoppingCartCheckoutModule } from "./shopping-cart-checkout/shopping-cart-checkout.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    DocumentExportModule,
    AuthModule,
    BillingInvoicingModule,
    InventoryControlModule,
    ProductCatalogModule,
    ShoppingCartCheckoutModule,
    HealthModule,
  ],
  exports: [AuthModule],
})
export class AppModule {}
