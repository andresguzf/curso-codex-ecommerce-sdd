"use client";

import { createAuthBrowserClient } from "@technology-ecommerce/api-client";
import type { AuthRole, AuthSession } from "@technology-ecommerce/api-schemas";
import { create } from "zustand";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export const authClient = createAuthBrowserClient({ baseUrl: apiBaseUrl });

type SessionStatus = "initializing" | "authenticated" | "anonymous";

type SessionState = Readonly<{
  notice: string | null;
  session: AuthSession | null;
  status: SessionStatus;
  clear: () => void;
  setSession: (session: AuthSession) => void;
  setNotice: (notice: string | null) => void;
  setStatus: (status: SessionStatus) => void;
}>;

export const useSessionStore = create<SessionState>((set) => ({
  notice: null,
  session: null,
  status: "initializing",
  clear: () => set({ session: null, status: "anonymous" }),
  setSession: (session) => set({ session, status: "authenticated" }),
  setNotice: (notice) => set({ notice }),
  setStatus: (status) => set({ status }),
}));

export function storefrontDestinationFor(role: AuthRole): string {
  if (role === "CUSTOMER") return "/account";
  const backofficeUrl =
    process.env.NEXT_PUBLIC_BACKOFFICE_URL ?? "http://localhost:3002";
  return `${backofficeUrl.replace(/\/$/, "")}/`;
}

export function isExternalDestination(destination: string): boolean {
  return /^https?:\/\//.test(destination);
}
