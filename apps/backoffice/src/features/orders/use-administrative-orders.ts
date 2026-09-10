"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../auth/session";
import { cancelOrder, completeOrder, getOrder, listOrders, type AdministrativeOrderFilters } from "./order-api";

export const ordersQueryRoot = ["backoffice", "orders"] as const;

export function useAdministrativeOrders(filters: AdministrativeOrderFilters) {
  const session = useSessionStore((state) => state.session);
  const authorized = session?.user.role === "ADMIN" || session?.user.role === "BILLING";
  return useQuery({
    queryKey: [...ordersQueryRoot, session?.user.id, "list", filters],
    queryFn: ({ signal }) => listOrders(session!.accessToken, filters, signal),
    enabled: authorized,
  });
}

export function useAdministrativeOrder(orderId: string) {
  const session = useSessionStore((state) => state.session);
  const authorized = session?.user.role === "ADMIN" || session?.user.role === "BILLING";
  return useQuery({
    queryKey: [...ordersQueryRoot, session?.user.id, "detail", orderId],
    queryFn: ({ signal }) => getOrder(session!.accessToken, orderId, signal),
    enabled: authorized,
  });
}

export function useOrderMutations(onSuccess: (message: string) => void, onError: (message: string) => void) {
  const session = useSessionStore((state) => state.session);
  const client = useQueryClient();
  async function refresh(message: string) {
    await client.invalidateQueries({ queryKey: ordersQueryRoot });
    onSuccess(message);
  }
  const complete = useMutation({
    mutationFn: (orderId: string) => completeOrder(session!.accessToken, orderId),
    onSuccess: () => refresh("Orden completada correctamente."),
    onError: (error: Error) => onError(error.message),
  });
  const cancel = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => cancelOrder(session!.accessToken, orderId, { reason }),
    onSuccess: () => refresh("Orden cancelada y stock restituido correctamente."),
    onError: (error: Error) => onError(error.message),
  });
  return { cancel, complete };
}
