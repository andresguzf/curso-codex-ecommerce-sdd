import { createHash } from "node:crypto";

// Immutable trusted artwork. Keep this version if a later design is introduced.
export const COMPANY_LOGO_KEY = "company-logo-v1.svg";
export const COMPANY_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" role="img" aria-label="Technology Store">
<rect width="240" height="80" rx="12" fill="#102d50"/>
<path d="M20 22h42v9H46v29H36V31H20z" fill="#ffffff"/>
<path d="M58 42h12v18H58z" fill="#38bdf8"/>
<circle cx="64" cy="28" r="6" fill="#38bdf8"/>
<path d="M86 20h134v3H86zM86 57h98v3H86z" fill="#38bdf8"/>
<text x="86" y="46" font-family="sans-serif" font-size="20" font-weight="700" fill="#ffffff">TECH STORE</text>
</svg>`;
export const COMPANY_LOGO_BYTES = Buffer.from(COMPANY_LOGO_SVG, "utf8");

export function companyLogoReference() {
  const base = (process.env.IMAGE_STORAGE_PUBLIC_BASE_URL ?? "http://localhost:3001/api/v1/media/images").replace(/\/$/, "");
  return { storageKey: COMPANY_LOGO_KEY, url: `${base}/${COMPANY_LOGO_KEY}`,
    sha256: createHash("sha256").update(COMPANY_LOGO_BYTES).digest("hex") };
}
