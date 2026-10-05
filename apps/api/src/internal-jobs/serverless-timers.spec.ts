import { ConfigService } from "@nestjs/config";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EnvironmentVariables } from "../config/environment";
import type { DatabaseService } from "../database/database.service";
import { CatalogImageRecoveryService } from "../product-catalog/image-storage/catalog-image-recovery.service";
import type { ImageReferenceLookup } from "../product-catalog/image-storage/image-reference.repository";
import { AnonymousCartCleanupService } from "../shopping-cart-checkout/anonymous-cart-cleanup.service";
import type { CartRepository } from "../shopping-cart-checkout/cart.repository";

describe("serverless bootstrap", () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it("does not start periodic timers or remote work in Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    const interval = vi.spyOn(globalThis, "setInterval");
    const config = new ConfigService({ VERCEL: "1", IMAGE_STORAGE_CATALOG_PROVIDER: "cloudinary",
      CLOUDINARY_CLOUD_NAME: "fake-cloud", CLOUDINARY_API_KEY: "fake-key", CLOUDINARY_API_SECRET: "fake-secret", CLOUDINARY_FOLDER_MODE: "dynamic" }) as ConfigService<EnvironmentVariables, true>;
    const recovery = new CatalogImageRecoveryService({} as DatabaseService, config, {} as ImageReferenceLookup);
    const reconcile = vi.spyOn(recovery, "reconcile");
    const cleanup = new AnonymousCartCleanupService({} as CartRepository);
    const run = vi.spyOn(cleanup, "run");
    recovery.onApplicationBootstrap();
    cleanup.onModuleInit();
    expect(interval).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
    await recovery.onModuleDestroy();
    cleanup.onModuleDestroy();
  });
});
