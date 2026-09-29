import type { AuthSession } from "@technology-ecommerce/api-schemas";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BackofficeShell } from "../src/features/layout/backoffice-shell";
import { useSessionStore } from "../src/features/auth/session";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const sessionFor = (role: "ADMIN" | "BILLING" | "CUSTOMER"): AuthSession => ({
  accessToken: "test-access-token",
  tokenType: "Bearer",
  accessTokenExpiresAt: "2026-09-23T12:00:00.000Z",
  sessionExpiresAt: "2026-09-30T12:00:00.000Z",
  user: {
    id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
    displayName: "Usuario de prueba",
    email: "user@example.com",
    role,
  },
});

function renderShell(role: "ADMIN" | "BILLING" | "CUSTOMER") {
  useSessionStore.getState().setSession(sessionFor(role));
  return render(
    <BackofficeShell>
      <main>Contenido de la página</main>
    </BackofficeShell>,
  );
}

describe("BackofficeShell", () => {
  beforeEach(() => {
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
    navigation.replace.mockReset();
  });

  it("muestra navegación y acciones permitidas para ADMIN", () => {
    renderShell("ADMIN");
    const sidebar = screen.getByRole("navigation", { name: "Navegación administrativa" });

    expect(within(sidebar).getByRole("link", { name: "Productos e inventario" })).toHaveAttribute("href", "/products");
    expect(within(sidebar).getByRole("link", { name: "Categorías" })).toHaveAttribute("href", "/categories");
    expect(within(sidebar).getByRole("link", { name: "Etiquetas" })).toHaveAttribute("href", "/tags");
    expect(within(sidebar).getByRole("link", { name: "Usuarios" })).toHaveAttribute("href", "/users");
    expect(within(sidebar).getByRole("link", { name: "Órdenes" })).toHaveAttribute("href", "/orders");
    expect(within(sidebar).getByRole("link", { name: "Facturas" })).toHaveAttribute("href", "/invoices");
    expect(within(sidebar).getByRole("link", { name: "Empresa" })).toHaveAttribute("href", "/store-profile");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.getByText("Usuario de prueba")).toBeInTheDocument();
  });

  it("limita BILLING a órdenes y facturas, sin enlazar administración de catálogo", () => {
    renderShell("BILLING");
    const sidebar = screen.getByRole("navigation", { name: "Navegación administrativa" });

    expect(within(sidebar).getByRole("link", { name: "Órdenes" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Facturas" })).toBeInTheDocument();
    expect(within(sidebar).getByRole("link", { name: "Empresa" })).toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: "Productos e inventario" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: "Categorías" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: "Etiquetas" })).not.toBeInTheDocument();
    expect(within(sidebar).queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("complementary")).getByText("Facturación")).toBeInTheDocument();
  });

  it("no muestra navegación administrativa a CUSTOMER ni a una sesión anónima", () => {
    const { rerender } = renderShell("CUSTOMER");
    expect(screen.queryByRole("navigation", { name: "Navegación administrativa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
    expect(screen.getByText("Contenido de la página")).toBeInTheDocument();

    useSessionStore.setState({ session: null, status: "anonymous" });
    rerender(<BackofficeShell><main>Contenido de la página</main></BackofficeShell>);
    expect(screen.queryByRole("navigation", { name: "Navegación administrativa" })).not.toBeInTheDocument();
  });

  it("colapsa y expande la navegación lateral con teclado sin perder nombres accesibles", async () => {
    const user = userEvent.setup();
    renderShell("ADMIN");
    const toggle = screen.getByRole("button", { name: "Contraer navegación lateral" });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Expandir navegación lateral" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "Productos e inventario" })).toBeInTheDocument();

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Contraer navegación lateral" })).toHaveAttribute("aria-expanded", "true");
  });

  it("ofrece navegación móvil accesible y la cierra con Escape devolviendo el foco", async () => {
    const user = userEvent.setup();
    const { container } = renderShell("BILLING");
    const menuButton = screen.getByRole("button", { name: "Abrir navegación administrativa" });

    expect(container.querySelector("aside")?.className).toContain("hidden");
    expect(container.querySelector("aside")?.className).toContain("lg:flex");
    expect(screen.queryByRole("navigation", { name: "Navegación administrativa móvil" })).not.toBeInTheDocument();

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const mobileNavigation = screen.getByRole("navigation", { name: "Navegación administrativa móvil" });
    expect(mobileNavigation.className).toContain("lg:hidden");
    expect(within(mobileNavigation).getByRole("link", { name: "Órdenes" })).toBeInTheDocument();
    expect(within(mobileNavigation).queryByRole("link", { name: "Productos e inventario" })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Navegación administrativa móvil" })).not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
