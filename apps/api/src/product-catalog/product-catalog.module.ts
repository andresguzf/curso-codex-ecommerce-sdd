import { Module } from "@nestjs/common";

import { AuthModule } from "../identity-access/auth.module.js";
import { CatalogSummaryReader } from "./catalog-summary.reader.js";
import { ImageStorageModule } from "./image-storage/image-storage.module.js";
import { ProductAdministrationController } from "./product-administration.controller.js";
import { ProductAdministrationRepository } from "./product-administration.repository.js";
import { ProductAdministrationService } from "./product-administration.service.js";
import { ProductListingController } from "./product-listing.controller.js";
import { CategoryController, TagController } from "./classification.controller.js";
import { ClassificationRepository } from "./classification.repository.js";
import { ClassificationService } from "./classification.service.js";
import { WishlistRepository } from "./wishlist.repository.js";
import { WishlistController } from "./wishlist.controller.js";
import { ProductImagesController } from "./product-images.controller.js";
import { ProductImagesRepository } from "./product-images.repository.js";
import { ProductImagesService } from "./product-images.service.js";
import { CatalogLandingController } from "./catalog-landing.controller.js";
import { CatalogLandingService } from "./catalog-landing.service.js";

@Module({
  controllers: [ProductAdministrationController, ProductListingController, CategoryController, TagController, WishlistController, ProductImagesController, CatalogLandingController],
  imports: [AuthModule, ImageStorageModule],
  providers: [CatalogSummaryReader, ProductAdministrationRepository, ProductAdministrationService, ClassificationRepository, ClassificationService, WishlistRepository, ProductImagesRepository, ProductImagesService, CatalogLandingService],
  exports: [ImageStorageModule, CatalogSummaryReader],
})
export class ProductCatalogModule {}
