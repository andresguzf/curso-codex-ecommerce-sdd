import type { AuthRole } from "./auth.types";

export const USER_STATUSES = ["ACTIVE", "INACTIVE", "BLOCKED"] as const;

export type UserStatus = (typeof USER_STATUSES)[number];

export type AdministrativeUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  role: AuthRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}>;

export type UserSortField =
  | "createdAt"
  | "displayName"
  | "email"
  | "role"
  | "status";

export type UserListQuery = Readonly<{
  page: number;
  pageSize: number;
  search?: string;
  role?: AuthRole;
  status?: UserStatus;
  sortBy: UserSortField;
  sortOrder: "asc" | "desc";
}>;

export type UserPage = Readonly<{
  items: AdministrativeUser[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

export type CreateAdministrativeUser = Readonly<{
  email: string;
  displayName: string;
  passwordHash: string;
  role: AuthRole;
  status: UserStatus;
}>;

export type UpdateAdministrativeUser = Readonly<{
  email?: string;
  displayName?: string;
  passwordHash?: string;
  role?: AuthRole;
  status?: UserStatus;
}>;
