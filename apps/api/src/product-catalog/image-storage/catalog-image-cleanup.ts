import type { DatabaseTransaction } from "../../database/database.service";
import { catalogImageOperations } from "../../database/schema";
import { catalogAssetProvider, parseCloudinaryAssetKey } from "./catalog-asset-key";

export async function enqueueCloudImageCleanup(tx: DatabaseTransaction, storageKey: string): Promise<void> {
  if (catalogAssetProvider(storageKey) !== "cloudinary") return;
  const identity = parseCloudinaryAssetKey(storageKey);
  await tx.insert(catalogImageOperations).values({ id: identity.uploadId, cloudName: identity.cloudName,
    storageKey, state: "PENDING" }).onConflictDoUpdate({ target: catalogImageOperations.id,
    set: { storageKey, state: "PENDING", attempts: 0, nextAttemptAt: new Date(), updatedAt: new Date() } });
}
