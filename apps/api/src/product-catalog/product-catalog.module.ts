import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module";
import { CatalogSummaryReader } from "./catalog-summary.reader";
import { ImageStorageModule } from "./image-storage/image-storage.module";
import { ProductAdministrationController } from "./product-administration.controller";
import { ProductAdministrationRepository } from "./product-administration.repository";
import { ProductAdministrationService } from "./product-administration.service";
import { ProductListingController } from "./product-listing.controller";
import { CategoryController, TagController } from "./classification.controller";
import { ClassificationRepository } from "./classification.repository";
import { ClassificationService } from "./classification.service";
import { WishlistRepository } from "./wishlist.repository";
import { WishlistController } from "./wishlist.controller";

@Module({
  controllers: [ProductAdministrationController, ProductListingController, CategoryController, TagController, WishlistController],
  imports: [AuthModule, ImageStorageModule],
  providers: [CatalogSummaryReader, ProductAdministrationRepository, ProductAdministrationService, ClassificationRepository, ClassificationService, WishlistRepository],
  exports: [ImageStorageModule, CatalogSummaryReader],
})
export class ProductCatalogModule {}
