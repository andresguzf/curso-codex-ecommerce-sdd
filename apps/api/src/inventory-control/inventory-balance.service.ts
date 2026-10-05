import { Inject, Injectable } from "@nestjs/common";

import { InventoryBalanceRepository } from "./inventory-balance.repository.js";
import type { InventoryBalancePage, InventoryBalanceQuery } from "./inventory-balance.types.js";

@Injectable()
export class InventoryBalanceService {
  constructor(
    @Inject(InventoryBalanceRepository)
    private readonly inventory: InventoryBalanceRepository,
  ) {}

  list(query: InventoryBalanceQuery): Promise<InventoryBalancePage> {
    return this.inventory.list(query);
  }
}
