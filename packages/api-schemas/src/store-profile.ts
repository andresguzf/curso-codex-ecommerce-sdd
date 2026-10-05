import { z } from "zod";

const nullableText = (max: number) => z.string().max(max).nullable();

export const storeProfileSchema = z.object({
  id: z.literal(1),
  tradeName: z.string().min(1).max(200),
  legalName: z.string().min(1).max(200),
  taxIdentifier: z.string().min(1).max(80),
  address: z.object({
    line1: z.string().min(1).max(250),
    line2: nullableText(250),
    city: z.string().min(1).max(120),
    region: nullableText(120),
    postalCode: nullableText(32),
    countryCode: z.string().regex(/^[A-Z]{2}$/),
  }),
  contact: z.object({ email: z.email().nullable(), phone: nullableText(40) }),
  logo: z.object({ storageKey: z.string().min(1).max(512), url: z.url().max(2048).refine((url) => /^https?:\/\//.test(url)), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});

export const storeProfileFormSchema = z.object({
  tradeName: z.string().trim().min(1, "Ingresa el nombre comercial.").max(200),
  legalName: z.string().trim().min(1, "Ingresa la razón social.").max(200),
  taxIdentifier: z.string().trim().min(1, "Ingresa el identificador fiscal.").max(80),
  line1: z.string().trim().min(1, "Ingresa la dirección.").max(250),
  line2: z.string().trim().max(250),
  city: z.string().trim().min(1, "Ingresa la ciudad.").max(120),
  region: z.string().trim().max(120),
  postalCode: z.string().trim().max(32),
  countryCode: z.string().trim().regex(/^[A-Z]{2}$/, "Usa un código de país de dos letras, por ejemplo CL."),
  email: z.union([z.email("Ingresa un correo válido."), z.literal("")]),
  phone: z.string().trim().max(40),
});

export type StoreProfile = z.infer<typeof storeProfileSchema>;
export type StoreProfileFormValues = z.infer<typeof storeProfileFormSchema>;
