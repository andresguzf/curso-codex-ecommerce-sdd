import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CatalogImageStorageService, createCatalogImageStorageService } from "./catalog-image-storage.service.js";

import { ImageMediaController } from "./image-media.controller.js";
import {
  ImageReferenceLookup,
  ImageReferenceRepository,
} from "./image-reference.repository.js";
import { ImageStorage } from "./image-storage.port.js";
import { ImageStorageService } from "./image-storage.service.js";
import { LocalImageStorage } from "./local-image-storage.js";
import { CatalogImageRecoveryService } from "./catalog-image-recovery.service.js";

@Module({
  controllers: [ImageMediaController],
  providers: [
    LocalImageStorage,
    { provide: ImageStorage, useExisting: LocalImageStorage },
    ImageReferenceRepository,
    { provide: ImageReferenceLookup, useExisting: ImageReferenceRepository },
    ImageStorageService,
    CatalogImageRecoveryService,
    {
      provide: CatalogImageStorageService,
      useFactory: createCatalogImageStorageService,
      inject: [ConfigService, LocalImageStorage, ImageReferenceLookup],
    },
  ],
  exports: [ImageStorageService, CatalogImageStorageService, CatalogImageRecoveryService],
})
export class ImageStorageModule {}
