import { Inject, Injectable } from "@nestjs/common";

import { ProductAdministrationRepository } from "./product-administration.repository";
import type { CatalogLanding } from "./catalog-landing.types";

@Injectable()
export class CatalogLandingService {
  constructor(@Inject(ProductAdministrationRepository) private readonly products: ProductAdministrationRepository) {}

  getComposition(): Promise<CatalogLanding> {
    return this.products.readLandingComposition();
  }
}
