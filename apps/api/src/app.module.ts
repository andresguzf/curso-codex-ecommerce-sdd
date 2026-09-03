import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnvironment } from "./config/environment";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./identity-access/auth.module";
import { InventoryControlModule } from "./inventory-control/inventory-control.module";
import { ProductCatalogModule } from "./product-catalog/product-catalog.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    DatabaseModule,
    AuthModule,
    InventoryControlModule,
    ProductCatalogModule,
    HealthModule,
  ],
  exports: [AuthModule],
})
export class AppModule {}
