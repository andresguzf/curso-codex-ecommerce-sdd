export type AuthSessionChange = "logout" | "session-changed";

type AuthSessionChangeListener = (message: AuthSessionChange) => void;

type AuthSessionCoordinator = Readonly<{
  publish: (message: AuthSessionChange) => void;
  subscribe: (listener: AuthSessionChangeListener) => () => void;
  close: () => void;
}>;

const isAuthSessionChange = (
  value: unknown,
): value is AuthSessionChange =>
  value === "logout" || value === "session-changed";

/**
 * Coordinates auth state between tabs without persisting access or refresh
 * credentials. BroadcastChannel is preferred; the storage event is a
 * compatibility fallback and carries only a small, non-sensitive
 * notification (never a credential).
 */
export function createAuthSessionCoordinator(
  channelName: string,
): AuthSessionCoordinator {
  const listeners = new Set<AuthSessionChangeListener>();
  const storageKey = `${channelName}:event`;
  const browserWindow =
    typeof globalThis.window === "undefined" ? undefined : globalThis.window;
  let channel: BroadcastChannel | undefined;
  if (browserWindow && typeof globalThis.BroadcastChannel !== "undefined") {
    try {
      channel = new globalThis.BroadcastChannel(channelName);
    } catch {
      // Some browser privacy modes expose BroadcastChannel but disallow it.
    }
  }

  const notify = (value: unknown): void => {
    if (!isAuthSessionChange(value)) return;

    for (const listener of listeners) listener(value);
  };

  const onChannelMessage = (event: MessageEvent<unknown>): void => {
    notify(event.data);
  };

  const onStorage = (event: StorageEvent): void => {
    if (event.key !== storageKey || !event.newValue) return;

    try {
      const payload: unknown = JSON.parse(event.newValue);
      if (typeof payload === "object" && payload !== null && "message" in payload) {
        notify(payload.message);
      }
    } catch {
      // Ignore malformed or manually edited notification values.
    }
  };

  channel?.addEventListener("message", onChannelMessage);
  browserWindow?.addEventListener("storage", onStorage);

  return {
    close: () => {
      channel?.removeEventListener("message", onChannelMessage);
      channel?.close();
      browserWindow?.removeEventListener("storage", onStorage);
      listeners.clear();
    },
    publish: (message) => {
      channel?.postMessage(message);

      if (!browserWindow) return;

      try {
        browserWindow.localStorage.setItem(
          storageKey,
          JSON.stringify({ message, timestamp: Date.now() }),
        );
      } catch {
        // Storage can be unavailable in private browsing or with blocked cookies.
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
