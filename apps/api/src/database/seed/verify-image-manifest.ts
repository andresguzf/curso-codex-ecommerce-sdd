import sharp from "sharp";
import { getDevelopmentProductImageManifest } from "./product-image-manifest.js";

async function verify(): Promise<void> {
  // Explicit opt-in, fail closed before the first network request. No database
  // connection, downloads to disk, Cloudinary credentials or production access.
  const products = getDevelopmentProductImageManifest(process.env.NODE_ENV);
  const images = products.flatMap((product) => product.images);
  const uniqueImages = [...new Map(images.map((image) => [image.url, image])).values()];
  for (let offset = 0; offset < uniqueImages.length; offset += 3) {
    await Promise.all(uniqueImages.slice(offset, offset + 3).map(async (image) => {
      const infoResponse = await fetch(`https://picsum.photos/id/${image.picsumId}/info`, { signal: AbortSignal.timeout(15_000) });
      if (!infoResponse.ok) throw new Error(`Picsum metadata unavailable for ID ${image.picsumId}: HTTP ${infoResponse.status}`);
      const info: unknown = await infoResponse.json();
      if (!info || typeof info !== "object" || !("id" in info) || info.id !== String(image.picsumId)) throw new Error(`Picsum ID mismatch: ${image.picsumId}`);
      const response = await fetch(image.url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`Picsum image unavailable for ID ${image.picsumId}: HTTP ${response.status}`);
      if (response.headers.get("content-type")?.split(";")[0] !== image.mimeType) throw new Error(`Picsum MIME mismatch for ID ${image.picsumId}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length > 6 * 1024 * 1024) throw new Error(`Picsum image exceeds verification size limit: ${image.picsumId}`);
      const metadata = await sharp(data).metadata();
      if (metadata.width !== image.width || metadata.height !== image.height || metadata.format !== image.format) throw new Error(`Picsum dimensions or format mismatch for ID ${image.picsumId}`);
    }));
  }
  console.log(JSON.stringify({ products: products.length, imageAssociations: images.length, uniquePhotos: uniqueImages.length, width: 1200, height: 900, format: "webp", outcome: "verified" }));
}

void verify().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Image manifest verification failed");
  process.exitCode = 1;
});
