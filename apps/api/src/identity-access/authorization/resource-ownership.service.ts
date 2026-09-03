import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import { invoices } from "../../database/schema/billing";
import { carts, orders } from "../../database/schema/commerce";
import type { OwnedResourceType } from "./ownership.decorator";

@Injectable()
export class ResourceOwnershipService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async isOwner(
    resourceType: OwnedResourceType,
    resourceId: string,
    userId: string,
  ): Promise<boolean> {
    switch (resourceType) {
      case "USER":
        return resourceId === userId;
      case "CART": {
        const [cart] = await this.database.client
          .select({ customerId: carts.customerId })
          .from(carts)
          .where(eq(carts.id, resourceId))
          .limit(1);

        return cart?.customerId === userId;
      }
      case "ORDER": {
        const [order] = await this.database.client
          .select({ customerId: orders.customerId })
          .from(orders)
          .where(eq(orders.id, resourceId))
          .limit(1);

        return order?.customerId === userId;
      }
      case "INVOICE": {
        const [invoice] = await this.database.client
          .select({ customerId: invoices.customerId })
          .from(invoices)
          .where(eq(invoices.id, resourceId))
          .limit(1);

        return invoice?.customerId === userId;
      }
    }
  }
}
