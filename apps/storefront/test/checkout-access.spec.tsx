import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { CheckoutAccessGate } from "../src/features/checkout/checkout-access-gate";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

describe("checkout access", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
  });

  it("asks a visitor to authenticate only when entering checkout", async () => {
    render(<CheckoutAccessGate><h1>Checkout</h1></CheckoutAccessGate>);

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/login?returnTo=%2Fcheckout",
      );
    });
  });

  it("keeps an authenticated customer in the checkout flow", () => {
    useSessionStore.getState().setSession({
      accessToken: "access-token",
      accessTokenExpiresAt: "2026-09-08T12:15:00.000Z",
      sessionExpiresAt: "2026-09-15T12:00:00.000Z",
      tokenType: "Bearer",
      user: {
        displayName: "Cliente Demo",
        email: "customer@example.com",
        id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
        role: "CUSTOMER",
      },
    });

    render(<CheckoutAccessGate><h1>Checkout</h1></CheckoutAccessGate>);

    expect(screen.getByRole("heading", {
      name: "Checkout",
    })).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
