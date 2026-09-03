import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../../database/database.service";
import { productImages } from "../../database/schema";

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

    return references.length > 0;
  }
}
