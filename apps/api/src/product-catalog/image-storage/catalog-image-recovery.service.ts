import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, eq, inArray, lte } from "drizzle-orm";

import type { EnvironmentVariables } from "../../config/environment";
import { DatabaseService } from "../../database/database.service";
import { catalogImageOperations } from "../../database/schema";
import { CloudinaryImageStorage } from "./cloudinary-image-storage";
import { ImageReferenceLookup } from "./image-reference.repository";
import { ImageStorageValidationError, type ImageUpload, type StoredImage } from "./image-storage.port";

export const IMAGE_RECOVERY_MAX_ATTEMPTS = 8;
export const IMAGE_RECOVERY_GRACE_MS = 120_000;

@Injectable()
export class CatalogImageRecoveryService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(CatalogImageRecoveryService.name);
  private readonly provider?: CloudinaryImageStorage;
  private readonly selected: boolean;
  get cloud(): CloudinaryImageStorage | undefined { return this.provider; }
  get enabled(): boolean { return this.selected; }
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private stopping = false;

  constructor(@Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(ConfigService) config: ConfigService<EnvironmentVariables, true>,
    @Inject(ImageReferenceLookup) private readonly references: ImageReferenceLookup) {
    this.selected = config.get("IMAGE_STORAGE_CATALOG_PROVIDER", { infer: true }) === "cloudinary";
    const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_FOLDER_MODE"] as const;
    if (keys.every((key) => config.get(key, { infer: true }))) this.provider = new CloudinaryImageStorage(config);
  }

  onApplicationBootstrap(): void {
    if (!this.cloud) return;
    // Delayed and bounded: bootstrap never performs a remote request.
    this.timer = setInterval(() => {
      if (this.running || this.stopping) return;
      this.running = this.reconcile().catch(() => {
        this.logger.warn({ event: "catalog.image.recovery_unavailable" });
      }).finally(() => { this.running = undefined; });
    }, 30_000);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }

  async uploadAndConfirm<T>(input: ImageUpload, confirm: (asset: StoredImage, id: string) => Promise<T>): Promise<T> {
    if (!this.cloud) throw new Error("Cloudinary recovery is not configured");
    const id = randomUUID();
    const result = await this.database.withImageOperationLock(id, async () => {
      await this.database.client.insert(catalogImageOperations).values({ id, cloudName: this.cloud!.configuredCloudName,
        state: "UPLOADING", nextAttemptAt: new Date(Date.now() + IMAGE_RECOVERY_GRACE_MS) });
      // Persist identity first. Never retry upload, even when its response is lost.
      try {
        const asset = await this.cloud!.upload(input, id);
        return await confirm(asset, id);
      } catch (error) {
        // If DB is down, the durable UPLOADING row remains recoverable after restart.
        await this.database.client.update(catalogImageOperations).set({ state: "PENDING", updatedAt: new Date() })
          .where(and(eq(catalogImageOperations.id, id), eq(catalogImageOperations.state, "UPLOADING")))
          .catch(() => undefined);
        throw error;
      }
    });
    if (result === undefined) throw new Error("Image operation coordination unavailable");
    return result;
  }

  async reconcile(now = new Date()): Promise<void> {
    if (!this.cloud) return;
    const due = await this.database.client.select().from(catalogImageOperations).where(and(
      eq(catalogImageOperations.cloudName, this.cloud.configuredCloudName),
      inArray(catalogImageOperations.state, ["UPLOADING", "PENDING"]), lte(catalogImageOperations.nextAttemptAt, now),
    )).orderBy(catalogImageOperations.nextAttemptAt).limit(20);
    for (const candidate of due) {
      if (this.stopping) break;
      await this.database.withImageOperationLock(candidate.id, async () => {
        const [row] = await this.database.client.select().from(catalogImageOperations).where(eq(catalogImageOperations.id, candidate.id));
        if (!row || !["UPLOADING", "PENDING"].includes(row.state) || row.nextAttemptAt > now) return;
        // Fence confirmations before remote work; no SQL transaction remains open.
        const fenced = await this.database.client.update(catalogImageOperations).set({ state: "PENDING", updatedAt: now })
          .where(and(eq(catalogImageOperations.id, row.id), inArray(catalogImageOperations.state, ["UPLOADING", "PENDING"]))).returning({ id: catalogImageOperations.id });
        if (!fenced.length) return;
        try {
          const asset = await this.cloud!.findUpload(row.id);
          if (!asset) {
            if (row.storageKey) { await this.finish(row.id, "DONE", now); return; }
            // An accepted upload may still be processing after timeout. Missing
            // results remain pending through the bounded visibility window.
            await this.retry(row.id, row.attempts, now, true);
            return;
          }
          if ((row.storageKey && row.storageKey !== asset.storageKey) || await this.references.isReferenced(asset.storageKey)) {
            await this.finish(row.id, "BLOCKED", now);
            return;
          }
          await this.database.client.update(catalogImageOperations).set({ storageKey: asset.storageKey }).where(eq(catalogImageOperations.id, row.id));
          await this.cloud!.delete(asset.storageKey);
          await this.finish(row.id, "DONE", now);
        } catch (error) {
          if (error instanceof ImageStorageValidationError || (error instanceof Error && error.name === "CloudinaryStorageError" && "kind" in error && error.kind === "upstream")) {
            await this.finish(row.id, "BLOCKED", now);
          } else await this.retry(row.id, row.attempts, now, false);
        }
      });
    }
  }

  async requeue(id: string): Promise<boolean> {
    if (!this.cloud) return false;
    const result = await this.database.withImageOperationLock(id, async () => {
      const [row] = await this.database.client.select().from(catalogImageOperations).where(eq(catalogImageOperations.id, id));
      if (!row || !["BLOCKED", "DONE"].includes(row.state) || row.cloudName !== this.cloud!.configuredCloudName) return false;
      if (row.storageKey && await this.references.isReferenced(row.storageKey)) return false;
      await this.database.client.update(catalogImageOperations).set({ state: "PENDING", attempts: 0, nextAttemptAt: new Date(), updatedAt: new Date() }).where(eq(catalogImageOperations.id, id));
      return true;
    });
    return result ?? false;
  }

  private finish(id: string, state: "DONE" | "BLOCKED", now: Date) {
    return this.database.client.update(catalogImageOperations).set({ state, updatedAt: now }).where(eq(catalogImageOperations.id, id));
  }

  private async retry(id: string, attempts: number, now: Date, absent: boolean): Promise<void> {
    const next = attempts + 1;
    await this.database.client.update(catalogImageOperations).set({ attempts: next,
      state: next >= IMAGE_RECOVERY_MAX_ATTEMPTS ? (absent ? "DONE" : "BLOCKED") : "PENDING",
      nextAttemptAt: new Date(now.getTime() + Math.min(3_600_000, 30_000 * 2 ** next)), updatedAt: now,
    }).where(eq(catalogImageOperations.id, id));
    this.logger.warn({ event: "catalog.image.recovery_deferred", operationId: id, attempts: next });
  }
}
