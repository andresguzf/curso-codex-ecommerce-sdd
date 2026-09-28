import {
  classificationSortFieldSchema,
  classificationStatusSchema,
  type ClassificationListQuery,
} from "@technology-ecommerce/api-schemas";
import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).max(1_000_000).catch(1);
const pageSizeSchema = z.coerce.number().int().min(1).max(100).catch(20);
const sortOrderSchema = z.enum(["asc", "desc"]);

export function parseClassificationQuery(params: URLSearchParams): ClassificationListQuery {
  const search = params.get("search")?.trim().slice(0, 200);
  const status = classificationStatusSchema.safeParse(params.get("status"));
  const sortBy = classificationSortFieldSchema.safeParse(params.get("sortBy"));
  const sortOrder = sortOrderSchema.safeParse(params.get("sortOrder"));
  return {
    page: pageSchema.parse(params.get("page") ?? 1),
    pageSize: pageSizeSchema.parse(params.get("pageSize") ?? 20),
    sortBy: sortBy.success ? sortBy.data : "createdAt",
    sortOrder: sortOrder.success ? sortOrder.data : "desc",
    ...(search ? { search } : {}),
    ...(status.success ? { status: status.data } : {}),
  };
}

export function classificationQueryToParams(query: ClassificationListQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("page", String(query.page));
  if (query.pageSize !== 20) params.set("pageSize", String(query.pageSize));
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  if (query.sortBy !== "createdAt") params.set("sortBy", query.sortBy);
  if (query.sortOrder !== "desc") params.set("sortOrder", query.sortOrder);
  return params;
}
