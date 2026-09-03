export const PRODUCT_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductImageReference = Readonly<{
  storageKey: string;
  url: string;
}>;

export type AdministrativeProduct = Readonly<{
  id: string;
  sku: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  image: ProductImageReference;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}>;

export const PRODUCT_AVAILABILITIES = ["IN_STOCK", "OUT_OF_STOCK"] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

export const PRODUCT_LIST_VIEWS = ["public", "administrative"] as const;
export type ProductListView = (typeof PRODUCT_LIST_VIEWS)[number];

export const PRODUCT_SORT_FIELDS = [
  "createdAt",
  "name",
  "price",
  "sku",
  "stockAvailable",
  "updatedAt",
] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export type ProductListItem = Readonly<
  Omit<AdministrativeProduct, "deletedAt"> & { stockAvailable: number }
>;

export type ProductDetail = Readonly<
  ProductListItem & { availability: ProductAvailability }
>;

export type ProductListQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductStatus;
  availability?: ProductAvailability;
  currency?: string;
  minPrice?: string;
  maxPrice?: string;
  sortBy: ProductSortField;
  sortOrder: "asc" | "desc";
  view: ProductListView;
}>;

export type ProductPage = Readonly<{
  items: ProductListItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

export type CreateAdministrativeProduct = Readonly<{
  sku: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  image: ProductImageReference;
  status: ProductStatus;
}>;

export type UpdateAdministrativeProduct = Readonly<{
  sku?: string;
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  image?: ProductImageReference;
}>;
