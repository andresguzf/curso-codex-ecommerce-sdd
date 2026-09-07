"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

import {
  DEFAULT_PRODUCT_IMAGE_URL,
  resolveProductImageUrl,
} from "./product-image-url";

type ProductImageProps = Omit<ImageProps, "onError" | "src"> & {
  alt: string;
  src?: string | null;
};

/** Renders a catalog image with a safe local fallback for bad or dead URLs. */
export function ProductImage({ alt, src, ...props }: ProductImageProps) {
  const safeSource = resolveProductImageUrl(src);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const effectiveSource = failedSource === safeSource
    ? DEFAULT_PRODUCT_IMAGE_URL
    : safeSource;

  return (
    <Image
      {...props}
      alt={alt}
      onError={() => setFailedSource(safeSource)}
      src={effectiveSource}
    />
  );
}
