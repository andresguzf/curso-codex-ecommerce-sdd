import { act, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@technology-ecommerce/api-schemas";

import { SessionProvider } from "../src/features/auth/session-provider";
import { authClient, useSessionStore } from "../src/features/auth/session";
import { claimAnonymousCart } from "../src/features/cart/cart-api";
import { CheckoutAccessGate } from "../src/features/checkout/checkout-access-gate";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("../src/features/cart/cart-api", () => ({ claimAnonymousCart: vi.fn() }));

const session: AuthSession = {
  accessToken: "test-token", tokenType: "Bearer",
  accessTokenExpiresAt: "2026-09-10T12:00:00.000Z", sessionExpiresAt: "2026-09-15T12:00:00.000Z",
  user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente", email: "customer@example.com", role: "CUSTOMER" },
};

function mountCheckout() {
  return render(<StrictMode><SessionProvider><CheckoutAccessGate><h1>Comprar</h1></CheckoutAccessGate></SessionProvider></StrictMode>);
}

describe("session restoration during effect replay", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    useSessionStore.setState({ notice: null, session: null, status: "initializing" });
    vi.mocked(claimAnonymousCart).mockResolvedValue({ adjustedProductIds: [], cart: {} as never });
  });
  afterEach(() => vi.restoreAllMocks());

  it("opens checkout when the shared refresh resolves after Strict Mode cleanup", async () => {
    let resolve!: (value: AuthSession) => void;
    const pending = new Promise<AuthSession>((done) => { resolve = done; });
    vi.spyOn(authClient, "refresh").mockReturnValue(pending);
    mountCheckout();
    expect(screen.getByText("Validando acceso al checkout…")).toBeInTheDocument();
    await act(async () => { resolve(session); await pending; });
    expect(await screen.findByRole("heading", { name: "Comprar" })).toBeInTheDocument();
    expect(useSessionStore.getState().status).toBe("authenticated");
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("leaves initialization and redirects visitors when refresh fails after replay", async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise<AuthSession>((_, fail) => { reject = fail; });
    vi.spyOn(authClient, "refresh").mockReturnValue(pending);
    mountCheckout();
    await act(async () => { reject(new Error("No session")); await pending.catch(() => undefined); });
    await waitFor(() => expect(useSessionStore.getState().status).toBe("anonymous"));
    expect(navigation.replace).toHaveBeenCalledWith("/login?returnTo=%2Fcheckout");
  });

  it("ignores a late response after unmount", async () => {
    let resolve!: (value: AuthSession) => void;
    const pending = new Promise<AuthSession>((done) => { resolve = done; });
    vi.spyOn(authClient, "refresh").mockReturnValue(pending);
    const view = mountCheckout();
    view.unmount();
    await act(async () => { resolve(session); await pending; });
    expect(useSessionStore.getState().session).toBeNull();
  });
});
