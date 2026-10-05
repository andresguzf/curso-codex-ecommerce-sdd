import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { InternalJobsController } from "./internal-jobs.controller";
import type { DatabaseService } from "../database/database.service";
import type { CatalogImageRecoveryService } from "../product-catalog/image-storage/catalog-image-recovery.service";
import type { AnonymousCartCleanupService } from "../shopping-cart-checkout/anonymous-cart-cleanup.service";
import type { EnvironmentVariables } from "../config/environment";

function fixture(preview = false) {
  const images = { reconcile: vi.fn().mockResolvedValue(undefined) };
  const carts = { run: vi.fn().mockResolvedValue(5) };
  let locked = false;
  const database = { withImageOperationLock: vi.fn(async (_id: string, action: () => Promise<unknown>) => {
    if (locked) return undefined;
    locked = true; try { return await action(); } finally { locked = false; }
  }) };
  const config = new ConfigService({ CRON_SECRET: "a".repeat(32), VERCEL: "1", VERCEL_ENV: preview ? "preview" : "production" }) as ConfigService<EnvironmentVariables, true>;
  return { images, carts, controller: new InternalJobsController(config, database as unknown as DatabaseService,
    images as unknown as CatalogImageRecoveryService, carts as unknown as AnonymousCartCleanupService) };
}
describe("daily maintenance", () => {
  it.each([undefined, "Bearer invalid"])("rejects unauthorized requests before touching data/assets", async (header) => {
    const { controller, images, carts } = fixture();
    await expect(controller.run(header)).rejects.toMatchObject({ response: { code: "JOB_UNAUTHORIZED" } });
    expect(images.reconcile).not.toHaveBeenCalled(); expect(carts.run).not.toHaveBeenCalled();
  });
  it("disables remote cleanup in previews even with the real authorization shape", async () => {
    const { controller, images } = fixture(true);
    await expect(controller.run(`Bearer ${"a".repeat(32)}`)).rejects.toThrow();
    expect(images.reconcile).not.toHaveBeenCalled();
  });
  it("serializes simultaneous invocations using the database session mutex", async () => {
    const { controller, images, carts } = fixture();
    const result = await Promise.all([controller.run(`Bearer ${"a".repeat(32)}`), controller.run(`Bearer ${"a".repeat(32)}`)]);
    expect(result).toContainEqual({ skipped: true, expiredCarts: 0 });
    expect(images.reconcile).toHaveBeenCalledTimes(1); expect(carts.run).toHaveBeenCalledTimes(1);
  });
});
