import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { CartRepository } from "./cart.repository";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

@Injectable()
export class AnonymousCartCleanupService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly carts: CartRepository) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.run().catch(() => {
        // Request-time expiration remains authoritative if a scheduled cleanup
        // temporarily fails. Infrastructure logging will be added centrally.
      });
    }, CLEANUP_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  run(now = new Date()): Promise<number> {
    return this.carts.deleteExpiredAnonymousCarts(now);
  }
}
