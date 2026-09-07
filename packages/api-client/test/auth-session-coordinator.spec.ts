import { afterEach, describe, expect, it, vi } from "vitest";

import { createAuthSessionCoordinator } from "../src/auth-session-coordinator";

describe("auth session coordinator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses a non-sensitive storage signal when BroadcastChannel is unavailable", () => {
    const values = new Map<string, string>();
    const storageListeners = new Set<(event: StorageEvent) => void>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => void values.delete(key),
      setItem: (key: string, value: string) => void values.set(key, value),
    } as Storage;
    const browserWindow = {
      addEventListener: (type: string, listener: EventListener) => {
        if (type === "storage") storageListeners.add(listener as (event: StorageEvent) => void);
      },
      localStorage,
      removeEventListener: (type: string, listener: EventListener) => {
        if (type === "storage") storageListeners.delete(listener as (event: StorageEvent) => void);
      },
    } as unknown as Window;
    vi.stubGlobal("window", browserWindow);
    vi.stubGlobal("BroadcastChannel", undefined);

    const coordinator = createAuthSessionCoordinator("technology-ecommerce-test-auth");
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);

    coordinator.publish("logout");
    const eventValue = values.get("technology-ecommerce-test-auth:event");
    expect(eventValue).toContain('"message":"logout"');
    expect(eventValue).not.toContain("token");

    storageListeners.forEach((storageListener) =>
      storageListener({
        key: "technology-ecommerce-test-auth:event",
        newValue: eventValue,
      } as StorageEvent),
    );
    expect(listener).toHaveBeenCalledWith("logout");

    unsubscribe();
    coordinator.close();
  });
});
