import { z } from "zod";

const requiredText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => requiredText(maximum).nullable().optional();
const addressSchema = z.object({
  line1: requiredText(250),
  line2: optionalText(250),
  city: requiredText(120),
  region: optionalText(120),
  postalCode: optionalText(32),
  countryCode: z.string().regex(/^[A-Z]{2}$/),
}).strict();
const contactSchema = z.object({
  email: z.email().max(254).nullable().optional(),
  phone: optionalText(40),
}).strict();
const logoSchema = z.object({
  storageKey: requiredText(512),
  url: z.url().max(2048),
}).strict();

export const storeProfileInputSchema = z.object({
  tradeName: requiredText(200),
  legalName: requiredText(200),
  taxIdentifier: requiredText(80),
  address: addressSchema,
  contact: contactSchema.optional(),
  logo: logoSchema.nullable().optional(),
}).strict();

export type StoreProfileInput = z.infer<typeof storeProfileInputSchema>;
export const storeProfilePatchSchema = z.object({
  tradeName: storeProfileInputSchema.shape.tradeName.optional(),
  legalName: storeProfileInputSchema.shape.legalName.optional(),
  taxIdentifier: storeProfileInputSchema.shape.taxIdentifier.optional(),
  address: addressSchema.partial().optional(),
  contact: contactSchema.partial().optional(),
  logo: logoSchema.nullable().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, "At least one field is required");

export type StoreProfilePatch = z.infer<typeof storeProfilePatchSchema>;

export function validateStoreProfile(input: unknown): StoreProfileInput {
  return storeProfileInputSchema.parse(input);
}
