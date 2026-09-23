"use client";

import { useRouter } from "next/navigation";
import { AuthApiError } from "@technology-ecommerce/api-client";
import { useFlashStore } from "@technology-ecommerce/ui";
import { authClient, useSessionStore } from "./session";
import { broadcastSessionChange } from "./session-provider";

export function LogoutButton() {
  const router = useRouter();
  const clear = useSessionStore((state) => state.clear);
  const showFlash = useFlashStore((state) => state.showFlash);
  async function logout() {
    try {
      await authClient.logout();
      clear();
      showFlash("success", "Sesión cerrada correctamente.");
      broadcastSessionChange("logout");
      router.replace("/login");
    } catch (error) {
      showFlash("error", error instanceof AuthApiError ? error.message : "No pudimos cerrar la sesión.");
    }
  }
  return <button onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-100">Cerrar sesión</button>;
}
