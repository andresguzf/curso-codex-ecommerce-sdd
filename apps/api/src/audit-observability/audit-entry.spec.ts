import { describe, expect, it } from "vitest";

import { createAuditEntry, sanitizeAuditChanges } from "./audit-entry";
import { runWithRequestContext } from "./request-context";

describe("audit entries", () => {
  it("keeps relevant changes and recursively removes credential-shaped fields", () => {
    const changes = sanitizeAuditChanges({
      after: {
        role: "ADMIN",
        password: "plain-text",
        passwordHash: "hash-value",
        session: {
          accessToken: "access-token",
          status: "ACTIVE",
        },
      },
      authorization: "Bearer secret",
      cookieHeader: "refresh=secret",
      authenticationMaterialChanged: true,
    });

    expect(changes).toEqual({
      after: { role: "ADMIN", session: { status: "ACTIVE" } },
      authenticationMaterialChanged: true,
    });
    expect(JSON.stringify(changes)).not.toMatch(
      /plain-text|hash-value|access-token|Bearer secret|refresh=secret/,
    );
  });

  it("creates an entry with actor, action and entity reference", () => {
    expect(
      createAuditEntry({
        action: "PRODUCT_UPDATED",
        actorUserId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
        changes: { before: { status: "ACTIVE" }, after: { status: "INACTIVE" } },
        entityId: "70fdc4ae-2f3f-4486-a84e-7de0e714e7f1",
        entityType: "PRODUCT",
      }),
    ).toEqual({
      action: "PRODUCT_UPDATED",
      actorUserId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
      changes: { before: { status: "ACTIVE" }, after: { status: "INACTIVE" } },
      entityId: "70fdc4ae-2f3f-4486-a84e-7de0e714e7f1",
      entityType: "PRODUCT",
    });
  });

  it("propagates the active request correlation ID into audit persistence", () => {
    const correlationId = "55171365-01e2-41f9-8f08-18a077349441";
    const entry = runWithRequestContext({ correlationId }, () =>
      createAuditEntry({
        action: "ORDER_CREATED",
        actorUserId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
        changes: { after: { status: "PROCESSING" } },
        entityId: "70fdc4ae-2f3f-4486-a84e-7de0e714e7f1",
        entityType: "ORDER",
      }),
    );

    expect(entry.correlationId).toBe(correlationId);
  });
});
