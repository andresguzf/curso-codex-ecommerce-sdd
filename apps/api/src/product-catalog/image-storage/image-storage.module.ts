import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { CatalogImageStorageService, createCatalogImageStorageService } from "./catalog-image-storage.service";

import { ImageMediaController } from "./image-media.controller";
import {
  ImageReferenceLookup,
  ImageReferenceRepository,
} from "./image-reference.repository";
import { ImageStorage } from "./image-storage.port";
import { ImageStorageService } from "./image-storage.service";
import { LocalImageStorage } from "./local-image-storage";
import { CatalogImageRecoveryService } from "./catalog-image-recovery.service";

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
