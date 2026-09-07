export const DEFAULT_PRODUCT_IMAGE_URL = "/images/product-placeholder.svg";

const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "picsum.photos",
  "res.cloudinary.com",
]);

function isAllowedLocalMediaUrl(url: URL): boolean {
  return (
    url.protocol === "http:" &&
    url.hostname === "localhost" &&
    url.port === "3001" &&
    url.pathname.startsWith("/api/v1/media/images/")
  );
}

/**
 * Keeps untrusted catalog data away from next/image.
 *
 * The API stores image references so they can later be replaced by managed
 * assets (for example, Cloudinary). Until then, an empty, malformed or
 * unconfigured URL resolves to a local placeholder instead of crashing the
 * Next.js image loader.
 */
export function resolveProductImageUrl(source: string | null | undefined): string {
  const value = source?.trim();
  if (!value) return DEFAULT_PRODUCT_IMAGE_URL;

  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    const isAllowedRemote =
      url.protocol === "https:" && ALLOWED_REMOTE_IMAGE_HOSTS.has(url.hostname);

    return isAllowedRemote || isAllowedLocalMediaUrl(url)
      ? url.toString()
      : DEFAULT_PRODUCT_IMAGE_URL;
  } catch {
    return DEFAULT_PRODUCT_IMAGE_URL;
  }
}
