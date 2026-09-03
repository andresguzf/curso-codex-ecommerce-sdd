import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackofficeLoginForm } from "../src/features/auth/login-form";
import { LogoutButton } from "../src/features/auth/logout-button";
import { authClient, backofficeDestinationFor, isBackofficeRole, useSessionStore } from "../src/features/auth/session";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

describe("backoffice authentication", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
  });

  it("announces invalid login fields accessibly", async () => {
    render(<BackofficeLoginForm />);
    fireEvent.click(screen.getByRole("button", { name: /Entrar al panel/ }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText("Correo corporativo")).toHaveAttribute("aria-invalid", "true");
  });

  it("allows only administrative roles and redirects customers to the storefront", () => {
    expect(isBackofficeRole("ADMIN")).toBe(true);
    expect(isBackofficeRole("BILLING")).toBe(true);
    expect(isBackofficeRole("CUSTOMER")).toBe(false);
    expect(backofficeDestinationFor("ADMIN")).toBe("/");
    expect(backofficeDestinationFor("CUSTOMER")).toBe("http://localhost:3000/account");
  });

  it("revokes logout and clears the administrative session", async () => {
    vi.spyOn(authClient, "logout").mockResolvedValue();
    useSessionStore.getState().setSession({ accessToken: "access-token", tokenType: "Bearer", accessTokenExpiresAt: "2026-09-02T10:15:00.000Z", sessionExpiresAt: "2026-09-09T10:15:00.000Z", user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "admin@example.com", displayName: "Admin", role: "ADMIN" } });
    render(<LogoutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(useSessionStore.getState().status).toBe("anonymous"));
    expect(navigation.replace).toHaveBeenCalledWith("/login");
  });
});
