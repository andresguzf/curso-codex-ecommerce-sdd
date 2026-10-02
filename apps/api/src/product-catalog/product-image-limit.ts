import { ConflictException } from "@nestjs/common";

export const MAX_PRODUCT_IMAGES = 4;

/** Call while holding the product row lock, before adding gallery references.
 * Existing oversized galleries may be edited, but must not grow further.
 */
export function assertProductImageCapacity(existingCount: number, additions = 1): void {
  if (additions > 0 && existingCount + additions > MAX_PRODUCT_IMAGES) {
    throw new ConflictException({
      code: "PRODUCT_IMAGE_LIMIT_REACHED",
      message: "A product can have at most four images, including its cover",
    });
  }
}
