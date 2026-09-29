import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import { productImages, storeLogoAssets } from "../../database/schema";

export abstract class ImageReferenceLookup {
  abstract isReferenced(storageKey: string): Promise<boolean>;
}

@Injectable()
export class ImageReferenceRepository extends ImageReferenceLookup {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {
    super();
  }

  async isReferenced(storageKey: string): Promise<boolean> {
    const references = await this.database.client
      .select({ id: productImages.id })
      .from(productImages)
      .where(eq(productImages.storageKey, storageKey))
      .limit(1);

    if (references.length > 0) return true;
    const logos = await this.database.client.select({ key: storeLogoAssets.storageKey })
      .from(storeLogoAssets).where(eq(storeLogoAssets.storageKey, storageKey)).limit(1);
    return logos.length > 0;
  }
}
