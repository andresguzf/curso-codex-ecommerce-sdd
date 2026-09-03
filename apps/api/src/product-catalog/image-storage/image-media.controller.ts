import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Res,
} from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import {
  ImageStorageNotFoundError,
  ImageStorageValidationError,
} from "./image-storage.port";
import { ImageStorageService } from "./image-storage.service";

@ApiTags("catalog-media")
@Controller("media/images")
export class ImageMediaController {
  constructor(
    @Inject(ImageStorageService) private readonly images: ImageStorageService,
  ) {}

  @Get(":storageKey")
  @ApiOperation({
    operationId: "readCatalogImage",
    summary: "Read an image from the configured catalog storage",
  })
  @ApiParam({ name: "storageKey" })
  @ApiProduces("image/jpeg", "image/png", "image/webp")
  @ApiOkResponse({
    description: "Stored image bytes",
    schema: { type: "string", format: "binary" },
  })
  @ApiNotFoundResponse({ description: "Image not found" })
  async read(
    @Param("storageKey") storageKey: string,
    @Res() reply: FastifyReply,
  ): Promise<FastifyReply> {
    try {
      const image = await this.images.read(storageKey);
      return reply
        .type(image.mimeType)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .send(image.data);
    } catch (error) {
      if (
        error instanceof ImageStorageNotFoundError ||
        error instanceof ImageStorageValidationError
      ) {
        throw new NotFoundException({
          code: "IMAGE_NOT_FOUND",
          message: "The requested image does not exist",
        });
      }
      throw error;
    }
  }
}
