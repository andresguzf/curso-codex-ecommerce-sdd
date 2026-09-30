"use client";

import { useQuery } from "@tanstack/react-query";
import type { AuthSession } from "@technology-ecommerce/api-schemas";
import { getDashboardSummary, type DashboardRole } from "./dashboard-api";

export function useDashboardSummary(session: AuthSession, role: DashboardRole) {
  return useQuery({
    queryKey: ["dashboard-summary", session.user.id, role],
    queryFn: ({ signal }) => getDashboardSummary(session.accessToken, role, signal),
    enabled: session.user.role === role,
    gcTime: 0,
    staleTime: 30_000,
    retry: false,
  });
}
