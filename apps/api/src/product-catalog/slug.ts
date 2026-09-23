export function normalizeSlug(value: string, maxLength = 220): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  if (!normalized) throw new Error("SLUG_EMPTY");
  return normalized;
}

export function slugCandidate(base: string, attempt: number, maxLength = 220): string {
  if (attempt < 1 || !Number.isSafeInteger(attempt)) throw new Error("Invalid slug attempt");
  const suffix = attempt === 1 ? "" : `-${attempt}`;
  return `${base.slice(0, maxLength - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
