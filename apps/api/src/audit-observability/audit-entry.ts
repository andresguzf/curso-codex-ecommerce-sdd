import type { NewAuditEntry } from "../database/schema";
import { getCorrelationId } from "./request-context";

const SENSITIVE_KEY_PARTS = [
  "apikey",
  "authorization",
  "cookie",
  "credential",
  "password",
  "passphrase",
  "secret",
  "token",
] as const;

function isSensitiveKey(key: string): boolean {
  const normalized = key.replaceAll(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function sanitizeValue(value: unknown, visited: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item, visited))
      .filter((item) => item !== undefined);
  }
  if (typeof value !== "object") return undefined;
  if (visited.has(value)) return "[CIRCULAR]";

  visited.add(value);
  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSensitiveKey(key)) continue;
    const nextValue = sanitizeValue(nestedValue, visited);
    if (nextValue !== undefined) sanitized[key] = nextValue;
  }
  visited.delete(value);
  return sanitized;
}

/**
 * Defense-in-depth for audit payloads. Domain snapshots should already select
 * only relevant fields; this boundary additionally removes credential-shaped
 * keys before JSON reaches PostgreSQL.
 */
export function sanitizeAuditChanges(
  changes: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return sanitizeValue(changes, new WeakSet()) as Readonly<
    Record<string, unknown>
  >;
}

export function createAuditEntry(input: {
  action: string;
  actorUserId: string | null;
  changes: Readonly<Record<string, unknown>>;
  entityId: string;
  entityType: string;
}): NewAuditEntry {
  const correlationId = getCorrelationId();

  return {
    action: input.action,
    actorUserId: input.actorUserId,
    changes: sanitizeAuditChanges(input.changes),
    ...(correlationId ? { correlationId } : {}),
    entityId: input.entityId,
    entityType: input.entityType,
  };
}
