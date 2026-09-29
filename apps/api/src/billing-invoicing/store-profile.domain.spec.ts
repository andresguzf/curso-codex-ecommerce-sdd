import { describe, expect, it } from "vitest";

import { validateStoreProfile } from "./store-profile.domain";

const validProfile = {
  tradeName: "Tecnología Central",
  legalName: "Tecnología Central SpA",
  taxIdentifier: "76.123.456-7",
  address: {
    line1: "Av. Principal 123",
    city: "Santiago",
    countryCode: "CL",
  },
};

describe("store profile domain validation", () => {
  it("accepts a complete physical address and normalizes surrounding whitespace", () => {
    expect(validateStoreProfile({
      ...validProfile,
      tradeName: "  Tecnología Central  ",
      contact: { email: "ventas@example.com", phone: "+56 2 1234 5678" },
      logo: { storageKey: "logos/store.svg", url: "https://example.com/store.svg" },
    })).toMatchObject({ tradeName: "Tecnología Central", address: { city: "Santiago" } });
  });

  it.each([
    { ...validProfile, tradeName: "   " },
    { ...validProfile, legalName: "" },
    { ...validProfile, taxIdentifier: " " },
    { ...validProfile, address: { ...validProfile.address, line1: " " } },
    { ...validProfile, address: { ...validProfile.address, city: "" } },
    { ...validProfile, address: { ...validProfile.address, countryCode: "Chile" } },
    { ...validProfile, contact: { email: "not-an-email" } },
    { ...validProfile, logo: { storageKey: "logos/store.svg", url: "not-a-url" } },
  ])("rejects missing or invalid business identity data: %#", (input) => {
    expect(() => validateStoreProfile(input)).toThrow();
  });

  it("rejects unknown fields instead of silently accepting business data outside the model", () => {
    expect(() => validateStoreProfile({ ...validProfile, status: "ACTIVE" })).toThrow();
  });
});
