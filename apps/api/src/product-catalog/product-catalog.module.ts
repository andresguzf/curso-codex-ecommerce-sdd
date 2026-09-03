import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { ImageStorageModule } from "./image-storage/image-storage.module";
import { ProductAdministrationController } from "./product-administration.controller";
import { ProductAdministrationRepository } from "./product-administration.repository";
import { ProductAdministrationService } from "./product-administration.service";
import { ProductListingController } from "./product-listing.controller";

@Module({
  controllers: [ProductAdministrationController, ProductListingController],
  imports: [AuthModule, ImageStorageModule],
  providers: [ProductAdministrationRepository, ProductAdministrationService],
  exports: [ImageStorageModule],
})
export class ProductCatalogModule {}
