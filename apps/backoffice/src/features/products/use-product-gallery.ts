"use client";

import { useQuery } from "@tanstack/react-query";

import { useSessionStore } from "../auth/session";
import { getAdministrativeProductGallery } from "./product-image-api";

export function useProductGallery(productId?: string) {
  const { session, status } = useSessionStore();
  const authorized = status === "authenticated" && session?.user.role === "ADMIN";
  const query = useQuery({
    queryKey: ["backoffice", "product-gallery", session?.user.id, productId],
    queryFn: ({ signal }) => getAdministrativeProductGallery(session!.accessToken, productId!, signal),
    enabled: authorized && Boolean(productId),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  return { authorized, query };
}
