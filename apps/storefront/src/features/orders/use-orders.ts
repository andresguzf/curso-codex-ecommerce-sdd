"use client";

import { useQuery } from "@tanstack/react-query";
import { useSessionStore } from "../auth/session";
import { getMyOrder, getMyOrders, type OrderFilters } from "./orders-api";

// No persisted or cross-account purchase cache. Consume the cancellation signal
// so leaving the customer area also aborts in-flight reads.
const privateQueryOptions = { gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: true } as const;

export function useMyOrders(filters: OrderFilters) {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateQueryOptions,
    queryKey: ["customer-orders", session?.user.id, "list", filters],
    enabled: session?.user.role === "CUSTOMER",
    queryFn: ({ signal }) => getMyOrders(session!.accessToken, filters, signal),
  });
}

export function useMyOrder(orderId: string) {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateQueryOptions,
    queryKey: ["customer-orders", session?.user.id, "detail", orderId],
    enabled: session?.user.role === "CUSTOMER",
    queryFn: ({ signal }) => getMyOrder(session!.accessToken, orderId, signal),
  });
}
