import { z } from "zod";

import { productClassificationSchema, productListItemSchema } from "./products";

export const landingCategorySchema = productClassificationSchema.extend({ status: z.literal("ACTIVE") }).strict();
export const landingProductSchema = productListItemSchema.omit({ isFeatured: true, featuredAt: true }).extend({
  status: z.literal("ACTIVE"),
  category: landingCategorySchema.nullable(),
  tags: z.array(landingCategorySchema),
}).strict();
export const catalogLandingQuerySchema = z.object({}).strict();
export const catalogLandingSchema = z.object({
  featuredProducts: z.array(landingProductSchema).max(3),
  latestProducts: z.array(landingProductSchema).max(9),
  highlightedCategories: z.array(z.object({
    category: landingCategorySchema,
    products: z.array(landingProductSchema).min(1).max(3),
  }).strict()).max(3),
}).strict().superRefine((value, context) => {
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  const featuredIds = value.featuredProducts.map((product) => product.id);
  const latestIds = value.latestProducts.map((product) => product.id);
  if (!unique([...featuredIds, ...latestIds])) {
    context.addIssue({ code: "custom", path: ["latestProducts"], message: "Featured and latest products must be distinct" });
  }
  if (!unique(value.highlightedCategories.map((section) => section.category.id))) {
    context.addIssue({ code: "custom", path: ["highlightedCategories"], message: "Categories must be distinct" });
  }
  value.highlightedCategories.forEach((section, index) => {
    if (!unique(section.products.map((product) => product.id)) || section.products.some((product) => product.category?.id !== section.category.id)) {
      context.addIssue({ code: "custom", path: ["highlightedCategories", index, "products"], message: "Products must be distinct and belong to their section category" });
    }
  });
});

export type CatalogLanding = z.infer<typeof catalogLandingSchema>;
export type LandingProduct = z.infer<typeof landingProductSchema>;
