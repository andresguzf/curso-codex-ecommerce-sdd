import { createHash, timingSafeEqual } from "node:crypto";
import { Controller, Get, Headers, Inject, Module, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiExcludeController } from "@nestjs/swagger";
import type { EnvironmentVariables } from "../config/environment.js";
import { DatabaseService } from "../database/database.service.js";
import { CatalogImageRecoveryService } from "../product-catalog/image-storage/catalog-image-recovery.service.js";
import { ImageStorageModule } from "../product-catalog/image-storage/image-storage.module.js";
import { AnonymousCartCleanupService } from "../shopping-cart-checkout/anonymous-cart-cleanup.service.js";
import { ShoppingCartCheckoutModule } from "../shopping-cart-checkout/shopping-cart-checkout.module.js";

@ApiExcludeController()
@Controller("internal/jobs")
export class InternalJobsController {
  constructor(@Inject(ConfigService) private readonly config: ConfigService<EnvironmentVariables, true>,
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(CatalogImageRecoveryService) private readonly images: CatalogImageRecoveryService,
    @Inject(AnonymousCartCleanupService) private readonly carts: AnonymousCartCleanupService) {}

  @Get("daily")
  async run(@Headers("authorization") authorization?: string) {
    const secret = this.config.get("CRON_SECRET", { infer: true });
    const preview = this.config.get("VERCEL", { infer: true }) === "1" && this.config.get("VERCEL_ENV", { infer: true }) !== "production";
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!secret || preview || !timingSafeEqual(digest(authorization ?? ""), digest(`Bearer ${secret}`))) {
      throw new UnauthorizedException({ code: "JOB_UNAUTHORIZED", message: "Scheduled job authorization required" });
    }
    const result = await this.database.withImageOperationLock("daily-maintenance-v1", async () => {
      await this.images.reconcile();
      return { skipped: false, expiredCarts: await this.carts.run() };
    });
    return result ?? { skipped: true, expiredCarts: 0 };
  }
}

@Module({ imports: [ImageStorageModule, ShoppingCartCheckoutModule], controllers: [InternalJobsController] })
export class InternalJobsModule {}
