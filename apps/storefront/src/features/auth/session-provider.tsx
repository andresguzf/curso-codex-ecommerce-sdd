"use client";

import { useEffect, type ReactNode } from "react";

import { authClient, useSessionStore } from "./session";

const CHANNEL_NAME = "technology-ecommerce-storefront-auth";

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const clear = useSessionStore((state) => state.clear);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    let active = true;
    const channel =
      typeof BroadcastChannel === "undefined"
        ? undefined
        : new BroadcastChannel(CHANNEL_NAME);

    async function restore() {
      try {
        const session = await authClient.refresh();
        if (active) setSession(session);
      } catch {
        if (active) clear();
      }
    }

    void restore();
    channel?.addEventListener("message", (event) => {
      if (event.data === "logout") clear();
      if (event.data === "session-changed") void restore();
    });

    return () => {
      active = false;
      channel?.close();
    };
  }, [clear, setSession]);

  return children;
}

export function broadcastSessionChange(message: "logout" | "session-changed") {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(message);
  channel.close();
}
