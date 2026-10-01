import { BadRequestException, Controller, Get, Header, Inject, Query } from "@nestjs/common";
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiProperty, ApiTags, OmitType } from "@nestjs/swagger";
import { z } from "zod";

import { CatalogLandingService } from "./catalog-landing.service";
import type { CatalogLanding } from "./catalog-landing.types";
import { ProductListItemDto } from "./product-listing.controller";

export class LandingProductDto extends OmitType(ProductListItemDto, ["isFeatured", "featuredAt"] as const) {
  @ApiProperty({ enum: ["ACTIVE"] }) declare status: "ACTIVE";
}

class LandingCategoryDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: ["ACTIVE"] }) status!: "ACTIVE";
}

class HighlightedCategoryDto {
  @ApiProperty({ type: LandingCategoryDto }) category!: LandingCategoryDto;
  @ApiProperty({ type: [LandingProductDto], minItems: 1, maxItems: 3 }) products!: LandingProductDto[];
}

export class CatalogLandingDto {
  @ApiProperty({ type: [LandingProductDto], maxItems: 3 }) featuredProducts!: LandingProductDto[];
  @ApiProperty({ type: [LandingProductDto], maxItems: 9 }) latestProducts!: LandingProductDto[];
  @ApiProperty({ type: [HighlightedCategoryDto], maxItems: 3 }) highlightedCategories!: HighlightedCategoryDto[];
}

@ApiTags("catalog")
@Controller("catalog")
export class CatalogLandingController {
  constructor(@Inject(CatalogLandingService) private readonly landing: CatalogLandingService) {}

  @Get("landing")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ operationId: "getCatalogLanding", summary: "Read the fixed public landing composition", description: "Up to three featured products, nine latest products excluding the displayed featured IDs, and three ordered non-empty categories with up to three products each. No query parameters are accepted. All sections share one database snapshot; no administrative editorial fields are exposed." })
  @ApiOkResponse({ type: CatalogLandingDto })
  @ApiBadRequestResponse({ description: "Query parameters are not supported; use GET /products for search, filters and pagination" })
  get(@Query() query: Record<string, unknown>): Promise<CatalogLanding> {
    if (!z.object({}).strict().safeParse(query).success) {
      throw new BadRequestException({ code: "REQUEST_VALIDATION_FAILED", message: "Landing does not accept query parameters" });
    }
    return this.landing.getComposition();
  }
}
