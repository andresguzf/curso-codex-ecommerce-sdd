"use client";

import { useEffect } from "react";

import { useSessionStore } from "../auth/session";

/** Keeps the administration theme scoped to authenticated ADMIN sessions. */
export function AdminThemeController() {
  const role = useSessionStore((state) => state.session?.user.role);

  useEffect(() => {
    document.documentElement.dataset.theme = role === "ADMIN" ? "dark" : "light";
  }, [role]);

  return null;
}
