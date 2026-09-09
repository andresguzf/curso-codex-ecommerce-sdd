"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ActiveCart } from "@technology-ecommerce/api-schemas";

import { useSessionStore } from "../auth/session";
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
} from "./cart-api";

export const CART_QUERY_ROOT = ["cart"] as const;

function cartQueryKey(customerId: string | undefined) {
  return [...CART_QUERY_ROOT, customerId ?? "anonymous"] as const;
}

export function useCart() {
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const isCustomer = session?.user.role === "CUSTOMER";
  const accessToken = isCustomer ? session.accessToken : undefined;
  const customerId = isCustomer ? session.user.id : undefined;
  const queryKey = cartQueryKey(customerId);

  const cartQuery = useQuery({
    queryFn: () => getCart(accessToken),
    queryKey,
  });

  function storeCart(cart: ActiveCart): void {
    queryClient.setQueryData(queryKey, cart);
  }

  function refreshAfterFailure(): void {
    void queryClient.invalidateQueries({ queryKey });
  }

  const addMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      addCartItem(accessToken, productId, quantity),
    onError: refreshAfterFailure,
    onSuccess: storeCart,
  });
  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      updateCartItem(accessToken, itemId, quantity),
    onError: refreshAfterFailure,
    onSuccess: storeCart,
  });
  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeCartItem(accessToken, itemId),
    onError: refreshAfterFailure,
    onSuccess: storeCart,
  });

  return {
    addItem: addMutation.mutateAsync,
    cartQuery,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
    isUpdating: updateMutation.isPending,
    removeItem: removeMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
  };
}
