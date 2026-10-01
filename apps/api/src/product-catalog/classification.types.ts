export const CLASSIFICATION_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type ClassificationStatus = (typeof CLASSIFICATION_STATUSES)[number];
export const CLASSIFICATION_SORT_FIELDS = ["createdAt", "updatedAt", "name", "slug", "status"] as const;
export type ClassificationSortField = (typeof CLASSIFICATION_SORT_FIELDS)[number];
export type ClassificationKind = "category" | "tag";

export type ClassificationQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  status?: ClassificationStatus;
  showOnLanding?: boolean;
  sortBy: ClassificationSortField;
  sortOrder: "asc" | "desc";
  view: "public" | "administrative";
}>;

export type ClassificationRecord = Readonly<{
  showOnLanding?: boolean;
  landingOrder?: number | null;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ClassificationStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}>;

export type CategoryRecord = Omit<ClassificationRecord, "description"> & { description: string };
export type TagRecord = Omit<ClassificationRecord, "description">;
export type ClassificationPage<T> = Readonly<{
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

export type ClassificationInput = Readonly<{
  name: string;
  slug?: string;
  description?: string;
  status?: ClassificationStatus;
}>;
export type ClassificationPatch = Readonly<Partial<ClassificationInput> & { showOnLanding?: boolean; landingOrder?: number | null }>;
