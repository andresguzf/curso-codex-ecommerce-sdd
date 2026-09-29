import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry";
import { DatabaseService } from "../database/database.service";
import { auditEntries, storeLogoAssets, storeProfiles, type StoreProfile } from "../database/schema";
import type { AuthenticatedUser } from "../identity-access/auth.types";
import {
  storeProfileInputSchema,
  type StoreProfileInput,
  type StoreProfilePatch,
} from "./store-profile.domain";

export type StoreProfileResponse = Readonly<{
  id: 1;
  tradeName: string;
  legalName: string;
  taxIdentifier: string;
  address: Readonly<{
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postalCode: string | null;
    countryCode: string;
  }>;
  contact: Readonly<{ email: string | null; phone: string | null }>;
  logo: Readonly<{ storageKey: string; url: string; sha256: string }> | null;
  createdAt: string;
  updatedAt: string;
}>;

function responseFor(row: StoreProfile): StoreProfileResponse {
  return {
    id: 1,
    tradeName: row.tradeName,
    legalName: row.legalName,
    taxIdentifier: row.taxIdentifier,
    address: {
      line1: row.addressLine1,
      line2: row.addressLine2,
      city: row.addressCity,
      region: row.addressRegion,
      postalCode: row.addressPostalCode,
      countryCode: row.addressCountryCode,
    },
    contact: { email: row.contactEmail, phone: row.contactPhone },
    logo: row.logoStorageKey && row.logoUrl && row.logoSha256
      ? { storageKey: row.logoStorageKey, url: row.logoUrl, sha256: row.logoSha256 }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mergeProfile(current: StoreProfile | undefined, patch: StoreProfilePatch): StoreProfileInput {
  const previous = current ? responseFor(current) : undefined;
  const candidate = {
    tradeName: patch.tradeName ?? previous?.tradeName,
    legalName: patch.legalName ?? previous?.legalName,
    taxIdentifier: patch.taxIdentifier ?? previous?.taxIdentifier,
    address: { ...previous?.address, ...patch.address },
    contact: { ...previous?.contact, ...patch.contact },
    logo: patch.logo === undefined ? previous?.logo ? { storageKey: previous.logo.storageKey } : null : patch.logo,
  };
  const parsed = storeProfileInputSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new BadRequestException({
      code: "REQUEST_VALIDATION_FAILED",
      message: "The store profile requires valid business identity and address fields",
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    });
  }
  return parsed.data;
}

@Injectable()
export class StoreProfileService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async get(actor: AuthenticatedUser): Promise<StoreProfileResponse> {
    if (actor.role !== "ADMIN" && actor.role !== "BILLING") throw this.forbidden();
    const [profile] = await this.database.client.select().from(storeProfiles).where(eq(storeProfiles.id, 1)).limit(1);
    if (!profile) throw new NotFoundException({ code: "STORE_PROFILE_NOT_FOUND", message: "Store profile is not configured" });
    return responseFor(profile);
  }

  async update(actor: AuthenticatedUser, patch: StoreProfilePatch): Promise<StoreProfileResponse> {
    if (actor.role !== "ADMIN") throw this.forbidden();
    return this.database.client.transaction(async (transaction) => {
      // Serializes creation and partial updates of the singleton, including the initially empty table.
      await transaction.execute(sql`select pg_advisory_xact_lock(739138, 1)`);
      const [current] = await transaction.select().from(storeProfiles).where(eq(storeProfiles.id, 1)).limit(1);
      const input = mergeProfile(current, patch);
      const [logoAsset] = input.logo
        ? await transaction.select().from(storeLogoAssets).where(eq(storeLogoAssets.storageKey, input.logo.storageKey)).limit(1)
        : [];
      if (input.logo && !logoAsset) throw new BadRequestException({
        code: "STORE_LOGO_UNKNOWN", message: "Select a logo uploaded through this API",
      });
      const now = new Date();
      const values = {
        tradeName: input.tradeName,
        legalName: input.legalName,
        taxIdentifier: input.taxIdentifier,
        addressLine1: input.address.line1,
        addressLine2: input.address.line2 ?? null,
        addressCity: input.address.city,
        addressRegion: input.address.region ?? null,
        addressPostalCode: input.address.postalCode ?? null,
        addressCountryCode: input.address.countryCode,
        contactEmail: input.contact?.email ?? null,
        contactPhone: input.contact?.phone ?? null,
        logoStorageKey: logoAsset?.storageKey ?? null,
        logoUrl: logoAsset?.url ?? null,
        logoSha256: logoAsset?.sha256 ?? null,
        updatedAt: now,
      };
      const [saved] = current
        ? await transaction.update(storeProfiles).set(values).where(eq(storeProfiles.id, 1)).returning()
        : await transaction.insert(storeProfiles).values({ ...values, id: 1, createdAt: now }).returning();
      if (!saved) throw new Error("Store profile write did not return a row");
      await transaction.insert(auditEntries).values(createAuditEntry({
        actorUserId: actor.id,
        action: current ? "STORE_PROFILE_UPDATED" : "STORE_PROFILE_CREATED",
        entityType: "STORE_PROFILE",
        entityId: "1",
        changes: { changedFields: Object.keys(patch), created: !current },
      }));
      return responseFor(saved);
    });
  }

  private forbidden(): ForbiddenException {
    return new ForbiddenException({ code: "AUTH_FORBIDDEN", message: "You do not have permission to manage the store profile" });
  }
}
