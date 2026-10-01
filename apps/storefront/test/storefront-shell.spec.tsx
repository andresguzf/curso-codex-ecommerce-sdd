import { fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StorefrontShell } from "../src/features/layout/storefront-shell";

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
beforeEach(() => { navigation.pathname = "/"; });

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children as ReactNode}</a>
  ),
}));

vi.mock("../src/features/auth/session-controls", () => ({
  SessionControls: () => <div>Acceso a la cuenta</div>,
}));

vi.mock("../src/features/cart/cart-shortcut", () => ({
  CartShortcut: () => <nav aria-label="Acceso rápido al carrito">Carrito</nav>,
}));

describe("StorefrontShell", () => {
  it.each([["/", "Inicio"], ["/products", "Productos"], ["/products/notebook", "Productos"], ["/products-other", null], ["/login", null]])("marca únicamente el enlace de la ruta %s", (pathname, active) => {
    navigation.pathname = pathname as string;
    render(<StorefrontShell><main>Contenido</main></StorefrontShell>);
    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    for (const name of ["Inicio", "Productos"]) {
      const link = within(nav).getByRole("link", { name });
      if (name === active) expect(link).toHaveAttribute("aria-current", "page");
      else expect(link).not.toHaveAttribute("aria-current");
    }
  });
  it("mantiene header, navegación, contenido y footer alrededor de sus páginas", () => {
    const { rerender } = render(
      <StorefrontShell>
        <main><h1>Catálogo disponible</h1></main>
      </StorefrontShell>,
    );

    const header = screen.getByRole("banner");
    const main = screen.getByRole("main");

    expect(header).toHaveClass("sticky", "top-0", "backdrop-blur-xl");
    expect(header).toHaveAttribute("data-scrolled", "false");
    expect(within(header).getByRole("link", { name: "Technology Store, inicio" })).toHaveAttribute("href", "/");
    expect(within(header).getByRole("navigation", { name: "Navegación principal" })).toHaveTextContent("Inicio");
    expect(within(header).getByRole("link", { name: "Productos" })).toHaveAttribute("href", "/products");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /administración/i })).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="storefront-shell"]')).toHaveClass("bg-[var(--ds-canvas)]");
    expect(within(header).getByRole("navigation", { name: "Acceso rápido al carrito" })).toBeInTheDocument();
    expect(main).toContainElement(screen.getByRole("heading", { name: "Catálogo disponible" }));
    expect(document.querySelector("#main-content")).toContainElement(main);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Tecnología para trabajar, crear y jugar.");
    expect(screen.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#main-content");

    rerender(
      <StorefrontShell>
        <main><h1>Detalle del producto</h1></main>
      </StorefrontShell>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Detalle del producto" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("expone una estructura semántica que se adapta a móvil y escritorio", () => {
    const { container } = render(<StorefrontShell><main><p>Contenido</p></main></StorefrontShell>);

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(container.querySelector("#main-content")).toHaveAttribute("tabIndex", "-1");
    expect(container.querySelector("header > div")?.className).toContain("md:flex-row");
    expect(container.querySelector("header")).toHaveAttribute("data-slot", "storefront-header");
    expect(container.querySelector("footer > div")?.className).toContain("sm:flex-row");
    expect(container.querySelector("svg[aria-hidden='true']")).toBeInTheDocument();
  });

  it("actualiza la transparencia al desplazar y restaura el estado al volver arriba", () => {
    const scroll = vi.spyOn(window, "scrollY", "get").mockReturnValue(0);
    const { unmount } = render(<StorefrontShell><main>Contenido</main></StorefrontShell>);
    const header = screen.getByRole("banner");
    scroll.mockReturnValue(100);
    fireEvent.scroll(window);
    expect(header).toHaveAttribute("data-scrolled", "true");
    scroll.mockReturnValue(0);
    fireEvent.scroll(window);
    expect(header).toHaveAttribute("data-scrolled", "false");
    unmount();
    scroll.mockRestore();
  });
});
