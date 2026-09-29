export type InventoryBalanceAvailability = "IN_STOCK" | "OUT_OF_STOCK";
export type InventoryBalanceSortField =
  | "name"
  | "sku"
  | "status"
  | "availableQuantity"
  | "updatedAt";

export type InventoryBalanceQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  availability?: InventoryBalanceAvailability;
  sortBy: InventoryBalanceSortField;
  sortOrder: "asc" | "desc";
}>;

export type InventoryBalanceItem = Readonly<{
  productId: string;
  sku: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  availableQuantity: number;
  version: number;
  updatedAt: Date;
}>;

export type InventoryBalancePage = Readonly<{
  items: InventoryBalanceItem[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;
