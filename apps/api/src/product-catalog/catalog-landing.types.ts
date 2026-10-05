import type { ProductClassificationSummary, ProductListItem } from "./product-administration.types.js";

export type LandingProduct = Omit<ProductListItem, "isFeatured" | "featuredAt">;
export type CatalogLanding = Readonly<{
  featuredProducts: LandingProduct[];
  latestProducts: LandingProduct[];
  highlightedCategories: {
    category: ProductClassificationSummary;
    products: LandingProduct[];
  }[];
}>;
