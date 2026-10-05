import { createHash } from "node:crypto";

import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

import { createAuditEntry } from "../audit-observability/audit-entry.js";
import { DatabaseService } from "../database/database.service.js";
import { auditEntries, storeLogoAssets } from "../database/schema/index.js";
import type { AuthenticatedUser } from "../identity-access/auth.types.js";
import { ImageStorageService } from "../product-catalog/image-storage/image-storage.service.js";
import { ImageStorageValidationError } from "../product-catalog/image-storage/image-storage.port.js";

@Injectable()
export class StoreLogoService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ImageStorageService) private readonly images: ImageStorageService,
  ) {}

  async upload(actor: AuthenticatedUser, data: unknown, mimeType: string | undefined) {
    if (actor.role !== "ADMIN") throw new ForbiddenException({ code: "AUTH_FORBIDDEN", message: "Only administrators can upload a store logo" });
    if (!Buffer.isBuffer(data) || !mimeType || !["image/png", "image/jpeg", "image/webp"].includes(mimeType)) {
      throw new BadRequestException({ code: "STORE_LOGO_INVALID", message: "Upload a PNG, JPEG or WebP image" });
    }
    let stored;
    try {
      stored = await this.images.upload({ data, mimeType });
    } catch (error) {
      if (error instanceof ImageStorageValidationError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }
    const sha256 = createHash("sha256").update(data).digest("hex");
    try {
      await this.database.client.transaction(async (transaction) => {
        await transaction.insert(storeLogoAssets).values({
          storageKey: stored.storageKey, url: stored.url, mimeType: stored.mimeType,
          size: stored.size, sha256,
        });
        await transaction.insert(auditEntries).values(createAuditEntry({
          actorUserId: actor.id, action: "STORE_LOGO_UPLOADED", entityType: "STORE_LOGO",
          entityId: stored.storageKey, changes: { mimeType: stored.mimeType, size: stored.size, sha256 },
        }));
      });
    } catch (error) {
      await this.images.deleteIfUnreferenced(stored.storageKey);
      throw error;
    }
    return { ...stored, sha256 };
  }
}
