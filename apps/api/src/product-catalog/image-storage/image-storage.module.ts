import { Module } from "@nestjs/common";

import { ImageMediaController } from "./image-media.controller";
import {
  ImageReferenceLookup,
  ImageReferenceRepository,
} from "./image-reference.repository";
import { ImageStorage } from "./image-storage.port";
import { ImageStorageService } from "./image-storage.service";
import { LocalImageStorage } from "./local-image-storage";

@Module({
  controllers: [ImageMediaController],
  providers: [
    LocalImageStorage,
    { provide: ImageStorage, useExisting: LocalImageStorage },
    ImageReferenceRepository,
    { provide: ImageReferenceLookup, useExisting: ImageReferenceRepository },
    ImageStorageService,
  ],
  exports: [ImageStorageService],
})
export class ImageStorageModule {}
