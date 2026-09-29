import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  smallint,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const storeProfiles = pgTable(
  "store_profiles",
  {
    id: smallint("id").primaryKey().default(1),
    tradeName: varchar("trade_name", { length: 200 }).notNull(),
    legalName: varchar("legal_name", { length: 200 }).notNull(),
    taxIdentifier: varchar("tax_identifier", { length: 80 }).notNull(),
    addressLine1: varchar("address_line_1", { length: 250 }).notNull(),
    addressLine2: varchar("address_line_2", { length: 250 }),
    addressCity: varchar("address_city", { length: 120 }).notNull(),
    addressRegion: varchar("address_region", { length: 120 }),
    addressPostalCode: varchar("address_postal_code", { length: 32 }),
    addressCountryCode: varchar("address_country_code", { length: 2 }).notNull(),
    contactEmail: varchar("contact_email", { length: 254 }),
    contactPhone: varchar("contact_phone", { length: 40 }),
    logoStorageKey: varchar("logo_storage_key", { length: 512 }),
    logoUrl: varchar("logo_url", { length: 2048 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("store_profiles_singleton", sql`${table.id} = 1`),
    check("store_profiles_trade_name_not_blank", sql`btrim(${table.tradeName}) <> ''`),
    check("store_profiles_legal_name_not_blank", sql`btrim(${table.legalName}) <> ''`),
    check("store_profiles_tax_identifier_not_blank", sql`btrim(${table.taxIdentifier}) <> ''`),
    check("store_profiles_address_line_1_not_blank", sql`btrim(${table.addressLine1}) <> ''`),
    check("store_profiles_address_city_not_blank", sql`btrim(${table.addressCity}) <> ''`),
    check("store_profiles_address_country_code_format", sql`${table.addressCountryCode} ~ '^[A-Z]{2}$'`),
    check("store_profiles_address_line_2_not_blank", sql`${table.addressLine2} is null or btrim(${table.addressLine2}) <> ''`),
    check("store_profiles_address_region_not_blank", sql`${table.addressRegion} is null or btrim(${table.addressRegion}) <> ''`),
    check("store_profiles_address_postal_code_not_blank", sql`${table.addressPostalCode} is null or btrim(${table.addressPostalCode}) <> ''`),
    check("store_profiles_contact_email_not_blank", sql`${table.contactEmail} is null or btrim(${table.contactEmail}) <> ''`),
    check("store_profiles_contact_phone_not_blank", sql`${table.contactPhone} is null or btrim(${table.contactPhone}) <> ''`),
    check("store_profiles_logo_reference_complete", sql`(${table.logoStorageKey} is null and ${table.logoUrl} is null) or (${table.logoStorageKey} is not null and btrim(${table.logoStorageKey}) <> '' and ${table.logoUrl} is not null and btrim(${table.logoUrl}) <> '')`),
  ],
);

export type StoreProfile = typeof storeProfiles.$inferSelect;
export type NewStoreProfile = typeof storeProfiles.$inferInsert;
