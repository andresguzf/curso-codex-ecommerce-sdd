import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, isNull } from "drizzle-orm";

import { createAuditEntry } from "../audit-observability/audit-entry";
import { DatabaseService, type DatabaseTransaction } from "../database/database.service";
import { auditEntries, productImages, products, type ProductImage } from "../database/schema";
import { assertProductImageCapacity } from "./product-image-limit";

export type ImagePatch = { altText?: string; isPrimary?: boolean; sortOrder?: number };
export type ImageAsset = { storageKey: string; url: string; mimeType: string; width: number; height: number };

@Injectable()
export class ProductImagesRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async mutate(productId: string, actorId: string, operation:
    | { kind: "add"; asset: ImageAsset; patch: ImagePatch & { altText: string } }
    | { kind: "edit"; imageId: string; patch: ImagePatch }
    | { kind: "delete"; imageId: string }): Promise<ProductImage> {
    return this.database.client.transaction(async (tx) => {
      const [product] = await tx.select().from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).for("update");
      if (!product) throw new NotFoundException({ code: "PRODUCT_NOT_FOUND", message: "The product does not exist" });
      const before = await tx.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder));
      if (operation.kind === "add") assertProductImageCapacity(before.length);
      const current = operation.kind === "add" ? undefined : before.find((image) => image.id === operation.imageId);
      if (operation.kind !== "add" && !current) throw new NotFoundException({ code: "PRODUCT_IMAGE_NOT_FOUND", message: "The product image does not exist" });
      const patch = operation.kind === "delete" ? {} : operation.patch;
      const lastPosition = operation.kind === "add" ? before.length : before.length - 1;
      if (patch.sortOrder !== undefined && patch.sortOrder > lastPosition) {
        throw new BadRequestException({ code: "PRODUCT_IMAGE_ORDER_INVALID", message: "The position must be within the gallery" });
      }
      if (product.status === "ACTIVE" && current?.isPrimary && (operation.kind === "delete" || patch.isPrimary === false)) {
        throw new ConflictException({ code: "PRODUCT_PRIMARY_IMAGE_REQUIRED", message: "Select another cover before removing the current cover" });
      }
      const primary = patch.isPrimary ?? (operation.kind === "add" ? !before.some((image) => image.isPrimary) : current!.isPrimary);
      if (primary && operation.kind !== "delete") {
        await tx.update(productImages).set({ isPrimary: false, updatedAt: new Date() }).where(and(eq(productImages.productId, productId), eq(productImages.isPrimary, true)));
      }
      let result: ProductImage;
      if (operation.kind === "add") {
        const temporary = Math.max(-1, ...before.map((image) => image.sortOrder)) + 1;
        if (temporary > 2_147_483_647) throw new ConflictException({ code: "PRODUCT_IMAGE_ORDER_INVALID", message: "Gallery positions exceed the supported range" });
        const [added] = await tx.insert(productImages).values({ ...operation.asset, productId, altText: operation.patch.altText, isPrimary: primary, sortOrder: temporary }).returning();
        result = added!;
      } else if (operation.kind === "edit") {
        const [edited] = await tx.update(productImages).set({ ...(patch.altText === undefined ? {} : { altText: patch.altText }), isPrimary: primary, updatedAt: new Date() }).where(eq(productImages.id, current!.id)).returning();
        result = edited!;
      } else {
        await tx.delete(productImages).where(eq(productImages.id, current!.id));
        result = current!;
      }
      const ordered = before.filter((image) => image.id !== result.id);
      if (operation.kind !== "delete") ordered.splice(patch.sortOrder ?? (operation.kind === "add" ? ordered.length : before.findIndex((image) => image.id === result.id)), 0, result);
      await this.reorder(tx, ordered);
      await tx.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
      const after = await tx.select().from(productImages).where(eq(productImages.productId, productId)).orderBy(asc(productImages.sortOrder));
      await tx.insert(auditEntries).values(createAuditEntry({ actorUserId: actorId, action: `PRODUCT_IMAGE_${operation.kind.toUpperCase()}`, entityType: "PRODUCT", entityId: productId, changes: { imageId: result.id, storageKey: result.storageKey, before, after } }));
      if (operation.kind === "delete") return result;
      return after.find((image) => image.id === result.id)!;
    });
  }

  private async reorder(tx: DatabaseTransaction, images: ProductImage[]): Promise<void> {
    // Move every row out of the final range before assigning dense positions;
    // the unique index must remain valid at each statement, not only at commit.
    const offset = Math.max(images.length, ...images.map((image) => image.sortOrder)) + 1;
    if (offset + images.length > 2_147_483_647) throw new ConflictException({ code: "PRODUCT_IMAGE_ORDER_INVALID", message: "Gallery positions exceed the supported range" });
    for (const [index, image] of images.entries()) await tx.update(productImages).set({ sortOrder: offset + index }).where(eq(productImages.id, image.id));
    for (const [index, image] of images.entries()) await tx.update(productImages).set({ sortOrder: index, updatedAt: new Date() }).where(eq(productImages.id, image.id));
  }
}
