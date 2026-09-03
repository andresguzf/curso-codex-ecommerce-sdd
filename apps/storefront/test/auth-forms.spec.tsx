import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "../src/features/auth/login-form";
import { RegisterForm } from "../src/features/auth/register-form";
import { SessionControls } from "../src/features/auth/session-controls";
import { authClient, storefrontDestinationFor, useSessionStore } from "../src/features/auth/session";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

describe("storefront authentication", () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
  });

  it("announces invalid login fields accessibly", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
  });

  it("registers a customer, starts the session and redirects to the account", async () => {
    vi.spyOn(authClient, "register").mockResolvedValue({ id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "ana@example.com", displayName: "Ana Díaz", role: "CUSTOMER" });
    vi.spyOn(authClient, "login").mockResolvedValue({ accessToken: "access-token", tokenType: "Bearer", accessTokenExpiresAt: "2026-09-02T10:15:00.000Z", sessionExpiresAt: "2026-09-09T10:15:00.000Z", user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "ana@example.com", displayName: "Ana Díaz", role: "CUSTOMER" } });
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Ana Díaz" } });
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "una-clave-segura-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/account"));
    expect(useSessionStore.getState().session?.user.role).toBe("CUSTOMER");
    expect(screen.queryByLabelText(/rol/i)).not.toBeInTheDocument();
  });

  it("maps privileged roles to the independent backoffice", () => {
    expect(storefrontDestinationFor("CUSTOMER")).toBe("/account");
    expect(storefrontDestinationFor("ADMIN")).toBe("http://localhost:3002/");
    expect(storefrontDestinationFor("BILLING")).toBe("http://localhost:3002/");
  });

  it("revokes logout, clears memory and announces the result", async () => {
    vi.spyOn(authClient, "logout").mockResolvedValue();
    useSessionStore.getState().setSession({ accessToken: "access-token", tokenType: "Bearer", accessTokenExpiresAt: "2026-09-02T10:15:00.000Z", sessionExpiresAt: "2026-09-09T10:15:00.000Z", user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", email: "ana@example.com", displayName: "Ana Díaz", role: "CUSTOMER" } });
    render(<SessionControls />);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(useSessionStore.getState().status).toBe("anonymous"));
    expect(useSessionStore.getState().session).toBeNull();
    expect(screen.getByText("Sesión cerrada correctamente.")).toHaveAttribute("aria-live", "polite");
  });
});
