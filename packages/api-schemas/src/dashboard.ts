import { z } from "zod";

const count = z.number().int().nonnegative();
const updatedAt = z.iso.datetime({ offset: true });
export const adminDashboardSummarySchema = z.object({
  role: z.literal("ADMIN"), updatedAt, lowStockThreshold: z.literal(5),
  metrics: z.object({
    totalCustomers: count, activeProducts: count, lowStockProducts: count,
    processingOrders: count, pendingInvoices: count,
  }).strict(),
}).strict();
export const billingDashboardSummarySchema = z.object({
  role: z.literal("BILLING"), updatedAt,
  period: z.object({ from: updatedAt, to: updatedAt, basis: z.literal("paidAt") }).strict()
    .refine((period) => Date.parse(period.from) <= Date.parse(period.to), { message: "Invalid dashboard period" }),
  metrics: z.object({
    ordersEligibleForInvoicing: count, ordersAwaitingInvoice: count, pendingInvoices: count, paidInvoices: count,
  }).strict(),
}).strict();
export const dashboardSummarySchema = z.discriminatedUnion("role", [adminDashboardSummarySchema, billingDashboardSummarySchema]);
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
