"use client";

import { useQuery } from "@tanstack/react-query";

import { useSessionStore } from "../auth/session";
import { getMyInvoice, getMyInvoices, type CustomerInvoiceFilters } from "./invoice-api";

const privateQueryOptions = {
  gcTime: 0,
  staleTime: 0,
  retry: false,
  refetchOnWindowFocus: true,
} as const;

export function useMyInvoices(filters: CustomerInvoiceFilters) {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateQueryOptions,
    queryKey: ["customer-invoices", session?.user.id, "list", filters],
    enabled: session?.user.role === "CUSTOMER",
    queryFn: ({ signal }) => getMyInvoices(session!.accessToken, filters, signal),
  });
}

export function useMyInvoice(invoiceId: string) {
  const session = useSessionStore((state) => state.session);
  return useQuery({
    ...privateQueryOptions,
    queryKey: ["customer-invoices", session?.user.id, "detail", invoiceId],
    enabled: session?.user.role === "CUSTOMER",
    queryFn: ({ signal }) => getMyInvoice(session!.accessToken, invoiceId, signal),
  });
}
