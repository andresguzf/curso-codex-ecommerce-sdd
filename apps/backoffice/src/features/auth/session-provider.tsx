"use client";

import {
  AuthApiError,
  createAuthSessionCoordinator,
} from "@technology-ecommerce/api-client";
import { useEffect, type ReactNode } from "react";

import { authClient, useSessionStore } from "./session";

const CHANNEL_NAME = "technology-ecommerce-backoffice-auth";

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const clear = useSessionStore((state) => state.clear);
  const setSession = useSessionStore((state) => state.setSession);

  useEffect(() => {
    let active = true;
    // Strict Mode replays effect setup and cleanup in development. Each setup
    // must own its promises so the replay never reuses work whose callback was
    // invalidated by the previous cleanup.
    let restoreInFlight: Promise<void> | undefined;
    let syncInFlight: Promise<void> | undefined;
    let restoreGeneration = 0;
    const coordinator = createAuthSessionCoordinator(CHANNEL_NAME);

    function restore(preserveAuthenticatedState = false): Promise<void> {
      if (restoreInFlight) return restoreInFlight;

      const generation = restoreGeneration;
      const request = authClient
        .refresh({ retryOnInvalidSession: true })
        .then((session) => {
          if (
            active &&
            generation === restoreGeneration &&
            (!preserveAuthenticatedState ||
              useSessionStore.getState().status !== "authenticated")
          ) {
            setSession(session);
          }
        })
        .catch(() => {
          if (!active || generation !== restoreGeneration) return;

          // A first restore can overlap a login submitted in this tab. Keep
          // that newer in-memory session, but clear it for later sync checks
          // when the refresh cookie is no longer valid.
          if (
            !preserveAuthenticatedState ||
            useSessionStore.getState().status !== "authenticated"
          ) {
            clear();
          }
        })
        .finally(() => {
          restoreInFlight = undefined;
        });

      restoreInFlight = request;
      return request;
    }

    function synchronizeSession(): Promise<void> {
      if (syncInFlight) return syncInFlight;

      const generation = restoreGeneration;
      const request = (async (): Promise<void> => {
        const currentSession = useSessionStore.getState().session;
        if (useSessionStore.getState().status !== "authenticated" || !currentSession) {
          await restore();
          return;
        }

        try {
          const user = await authClient.getCurrentUser(currentSession.accessToken);
          if (
            active &&
            generation === restoreGeneration &&
            useSessionStore.getState().session?.accessToken === currentSession.accessToken
          ) {
            setSession({ ...currentSession, user });
          }
        } catch (error) {
          if (error instanceof AuthApiError && error.status === 401) {
            await restore();
          }
        }
      })().finally(() => {
        syncInFlight = undefined;
      });

      syncInFlight = request;
      return request;
    }

    void restore(true);
    const unsubscribe = coordinator.subscribe((message) => {
      if (message === "logout") {
        restoreGeneration += 1;
        clear();
        return;
      }

      void synchronizeSession();
    });

    const synchronizeWhenVisible = (): void => {
      if (document.visibilityState === "visible") void synchronizeSession();
    };

    window.addEventListener("focus", synchronizeWhenVisible);
    document.addEventListener("visibilitychange", synchronizeWhenVisible);

    return () => {
      active = false;
      unsubscribe();
      coordinator.close();
      window.removeEventListener("focus", synchronizeWhenVisible);
      document.removeEventListener("visibilitychange", synchronizeWhenVisible);
    };
  }, [clear, setSession]);

  return children;
}

export function broadcastSessionChange(message: "logout" | "session-changed") {
  const coordinator = createAuthSessionCoordinator(CHANNEL_NAME);
  coordinator.publish(message);
  coordinator.close();
}
