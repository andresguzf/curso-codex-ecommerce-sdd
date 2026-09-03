"use client";

import { createAuthBrowserClient } from "@technology-ecommerce/api-client";
import type { AuthRole, AuthSession } from "@technology-ecommerce/api-schemas";
import { create } from "zustand";

export const authClient = createAuthBrowserClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1",
});

type SessionStatus = "initializing" | "authenticated" | "anonymous";
type SessionState = Readonly<{
  notice: string | null;
  session: AuthSession | null;
  status: SessionStatus;
  clear: () => void;
  setSession: (session: AuthSession) => void;
  setNotice: (notice: string | null) => void;
}>;

export const useSessionStore = create<SessionState>((set) => ({
  notice: null,
  session: null,
  status: "initializing",
  clear: () => set({ session: null, status: "anonymous" }),
  setSession: (session) => set({ session, status: "authenticated" }),
  setNotice: (notice) => set({ notice }),
}));

export function backofficeDestinationFor(role: AuthRole): string {
  if (role === "ADMIN" || role === "BILLING") return "/";
  const storefrontUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000";
  return `${storefrontUrl.replace(/\/$/, "")}/account`;
}

export function isBackofficeRole(role: AuthRole): boolean {
  return role === "ADMIN" || role === "BILLING";
}
