"use client";

import {
  AuthApiError,
  createAuthSessionCoordinator,
} from "@technology-ecommerce/api-client";
import { useEffect, type ReactNode } from "react";

import { authClient, useSessionStore } from "./session";
import { claimAnonymousCart } from "../cart/cart-api";

const CHANNEL_NAME = "technology-ecommerce-storefront-auth";

export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const clear = useSessionStore((state) => state.clear);
  const setSession = useSessionStore((state) => state.setSession);
  const setNotice = useSessionStore((state) => state.setNotice);

  useEffect(() => {
    let active = true;
    // Each effect setup must own its callbacks. Strict Mode replays setup and
    // cleanup; reusing the previous setup's promise would discard its result.
    let restoreInFlight: Promise<void> | undefined;
    let syncInFlight: Promise<void> | undefined;
    let restoreGeneration = 0;
    const coordinator = createAuthSessionCoordinator(CHANNEL_NAME);

    function restore(preserveAuthenticatedState = false): Promise<void> {
      if (restoreInFlight) return restoreInFlight;

      const generation = restoreGeneration;
      const request = authClient
        .refresh({ retryOnInvalidSession: true })
        .then(async (session) => {
          if (!active || generation !== restoreGeneration) return;
          if (session.user.role === "CUSTOMER") {
            try {
              const claim = await claimAnonymousCart(session.accessToken);
              if (claim.adjustedProductIds.length) {
                setNotice("Ajustamos algunas cantidades del carrito al stock disponible.");
              }
            } catch {
              // Restoring the authenticated session remains useful. A later
              // refresh can retry adoption of the anonymous cart.
            }
          }
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
  }, [clear, setNotice, setSession]);

  return children;
}

export function broadcastSessionChange(message: "logout" | "session-changed") {
  const coordinator = createAuthSessionCoordinator(CHANNEL_NAME);
  coordinator.publish(message);
  coordinator.close();
}
