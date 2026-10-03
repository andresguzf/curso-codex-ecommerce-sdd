export const DEFAULT_PRODUCT_IMAGE_URL = "/images/product-placeholder.svg";

const ALLOWED_REMOTE_IMAGE_HOSTS = new Set([
  "images.unsplash.com",
  "picsum.photos",
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
 * Accepts existing local/demo references and unsigned, versioned Cloudinary
 * catalog assets. Empty, malformed or unconfigured URLs use the existing
 * placeholder instead of crashing the Next.js image loader.
 */
export function resolveProductImageUrl(source: string | null | undefined): string {
  const value = source?.trim();
  if (!value) return DEFAULT_PRODUCT_IMAGE_URL;

  if (value.startsWith("/") && !value.startsWith("//")) return value;

  try {
    const url = new URL(value);
    const isAllowedRemote =
      url.protocol === "https:" && !url.username && !url.password && !url.port && (
        ALLOWED_REMOTE_IMAGE_HOSTS.has(url.hostname) || (
          url.hostname === "res.cloudinary.com" && !url.search && !url.hash &&
          /^\/[a-zA-Z0-9_-]+\/image\/upload\/v[0-9]+\/codex-storefront\/[^/]+$/.test(url.pathname)
        )
      );

    return isAllowedRemote || isAllowedLocalMediaUrl(url)
      ? url.toString()
      : DEFAULT_PRODUCT_IMAGE_URL;
  } catch {
    return DEFAULT_PRODUCT_IMAGE_URL;
  }
}
