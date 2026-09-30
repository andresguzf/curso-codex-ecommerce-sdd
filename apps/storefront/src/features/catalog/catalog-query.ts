import {
  productListQuerySchema,
  type ProductAvailability,
  type ProductSortField,
} from "@technology-ecommerce/api-schemas";

export type CatalogQuery = {
  availability?: ProductAvailability;
  categoryId?: string;
  tagIds?: string[];
  maxPrice?: string;
  minPrice?: string;
  page: number;
  search?: string;
  sortBy: ProductSortField;
  sortOrder: "asc" | "desc";
};

export const CATALOG_LANDING_PAGE_SIZE = 9;
export const CATALOG_PAGE_SIZE = 12;

export const defaultCatalogQuery: CatalogQuery = {
  page: 1,
  sortBy: "createdAt",
  sortOrder: "desc",
};

type SearchParamsReader = Pick<URLSearchParams, "get">;

export function parseCatalogQuery(
  searchParams: SearchParamsReader,
  pageSize = CATALOG_LANDING_PAGE_SIZE,
): CatalogQuery {
  const parsed = productListQuerySchema.safeParse({
    availability: searchParams.get("availability") || undefined,
    categoryId: searchParams.get("categoryId") || undefined,
    tagIds: searchParams.get("tagIds")?.split(",").filter(Boolean),
    maxPrice: searchParams.get("maxPrice") || undefined,
    minPrice: searchParams.get("minPrice") || undefined,
    page: searchParams.get("page") || 1,
    pageSize,
    search: searchParams.get("search") || undefined,
    sortBy: searchParams.get("sortBy") || defaultCatalogQuery.sortBy,
    sortOrder: searchParams.get("sortOrder") || defaultCatalogQuery.sortOrder,
    view: "public",
  });

  if (!parsed.success) {
    return defaultCatalogQuery;
  }

  return {
    availability: parsed.data.availability,
    ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
    ...(parsed.data.tagIds ? { tagIds: parsed.data.tagIds } : {}),
    maxPrice: parsed.data.maxPrice,
    minPrice: parsed.data.minPrice,
    page: parsed.data.page,
    search: parsed.data.search,
    sortBy: parsed.data.sortBy,
    sortOrder: parsed.data.sortOrder,
  };
}
