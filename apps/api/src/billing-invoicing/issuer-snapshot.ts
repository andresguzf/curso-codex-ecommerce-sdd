import { ConflictException } from "@nestjs/common";
import { eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../database/database.service";
import { storeProfiles, type StoreProfile } from "../database/schema";
import { companyLogoReference } from "./company-logo";

export type IssuerSnapshot = Readonly<{
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
}>;

export function issuerSnapshotFromProfile(profile: StoreProfile): IssuerSnapshot {
  return {
    tradeName: profile.tradeName,
    legalName: profile.legalName,
    taxIdentifier: profile.taxIdentifier,
    address: {
      line1: profile.addressLine1,
      line2: profile.addressLine2,
      city: profile.addressCity,
      region: profile.addressRegion,
      postalCode: profile.addressPostalCode,
      countryCode: profile.addressCountryCode,
    },
    contact: { email: profile.contactEmail, phone: profile.contactPhone },
    logo: companyLogoReference(),
  };
}

export async function currentIssuerSnapshot(transaction: DatabaseTransaction): Promise<IssuerSnapshot> {
  const [profile] = await transaction.select().from(storeProfiles).where(eq(storeProfiles.id, 1)).limit(1).for("share");
  if (!profile) throw new ConflictException({
    code: "STORE_PROFILE_NOT_CONFIGURED",
    message: "The store profile must be configured before creating an order or invoice",
  });
  return issuerSnapshotFromProfile(profile);
}
