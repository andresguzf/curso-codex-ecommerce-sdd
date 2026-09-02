import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  database: z.object({
    status: z.literal("up"),
    name: z.string().trim().min(1),
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
