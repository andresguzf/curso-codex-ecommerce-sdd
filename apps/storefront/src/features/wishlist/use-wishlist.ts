"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useSessionStore } from "../auth/session";
import { addWishlistItem, getWishlistPage, getWishlistProductIds, removeWishlistItem } from "./wishlist-api";

const privateOptions = { gcTime: 0, retry: false, staleTime: 0 } as const;

export function useWishlistMembership() {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateOptions,
    enabled: session?.user.role === "CUSTOMER",
    queryKey: ["wishlist", session?.user.id, "membership"],
    queryFn: ({ signal }) => getWishlistProductIds(session!.accessToken, signal),
  });
}

export function useWishlistPage(page: number) {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateOptions,
    enabled: session?.user.role === "CUSTOMER",
    queryKey: ["wishlist", session?.user.id, "page", page],
    queryFn: ({ signal }) => getWishlistPage(session!.accessToken, page, 12, signal),
  });
}

export function useWishlistActions() {
  const session = useSessionStore((state) => state.session);
  const queryClient = useQueryClient();
  const customerId = session?.user.id;
  const add = useMutation({
    mutationFn: (productId: string) => addWishlistItem(session!.accessToken, productId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["wishlist", customerId] }); },
  });
  const remove = useMutation({
    mutationFn: (productId: string) => removeWishlistItem(session!.accessToken, productId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["wishlist", customerId] }); },
  });
  return { add, remove };
}
