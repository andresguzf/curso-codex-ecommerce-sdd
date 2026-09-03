"use client";

import { useRouter } from "next/navigation";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { authClient, useSessionStore } from "./session";
import { broadcastSessionChange } from "./session-provider";

export function LogoutButton() {
  const router = useRouter();
  const { clear, notice, setNotice } = useSessionStore();
  async function logout() {
    try {
      await authClient.logout();
      clear();
      setNotice("Sesión cerrada correctamente.");
      broadcastSessionChange("logout");
      router.replace("/login");
    } catch (error) {
      setNotice(error instanceof AuthApiError ? error.message : "No pudimos cerrar la sesión.");
    }
  }
  return <div><button onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-100">Cerrar sesión</button><p aria-live="polite" className="mt-2 text-sm text-slate-600">{notice}</p></div>;
}
