import { act, render, screen, waitFor } from "@testing-library/react";
import type { AuthSession } from "@technology-ecommerce/api-schemas";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authClient, useSessionStore } from "../src/features/auth/session";
import { SessionProvider } from "../src/features/auth/session-provider";

const session: AuthSession = {
  accessToken: "backoffice-token",
  tokenType: "Bearer",
  accessTokenExpiresAt: "2026-09-11T12:00:00.000Z",
  sessionExpiresAt: "2026-09-18T12:00:00.000Z",
  user: {
    id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
    displayName: "Administración",
    email: "admin@example.com",
    role: "ADMIN",
  },
};

function SessionState() {
  const status = useSessionStore((state) => state.status);
  return <p>{status}</p>;
}

function mountProvider() {
  return render(
    <StrictMode>
      <SessionProvider>
        <SessionState />
      </SessionProvider>
    </StrictMode>,
  );
}

describe("backoffice session restoration during effect replay", () => {
  beforeEach(() => {
    useSessionStore.setState({ notice: null, session: null, status: "initializing" });
  });

  afterEach(() => vi.restoreAllMocks());

  it("applies a refresh resolved after the first Strict Mode cleanup", async () => {
    let resolve!: (value: AuthSession) => void;
    const pending = new Promise<AuthSession>((done) => {
      resolve = done;
    });
    vi.spyOn(authClient, "refresh").mockReturnValue(pending);

    mountProvider();
    expect(screen.getByText("initializing")).toBeInTheDocument();

    await act(async () => {
      resolve(session);
      await pending;
    });

    expect(await screen.findByText("authenticated")).toBeInTheDocument();
    expect(useSessionStore.getState().session).toEqual(session);
  });

  it("leaves initialization when restoration fails during effect replay", async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<AuthSession>((_, fail) => {
      reject = fail;
    });
    vi.spyOn(authClient, "refresh").mockReturnValue(pending);

    mountProvider();
    await act(async () => {
      reject(new Error("No active session"));
      await pending.catch(() => undefined);
    });

    await waitFor(() => expect(screen.getByText("anonymous")).toBeInTheDocument());
    expect(useSessionStore.getState().session).toBeNull();
  });
});
