import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveCart } from "@technology-ecommerce/api-schemas";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { getCart, updateCartItem } from "../src/features/cart/cart-api";
import { CartPage } from "../src/features/cart/cart-page";
import { StorefrontShell } from "../src/features/layout/storefront-shell";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children as ReactNode}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("../src/features/cart/cart-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/features/cart/cart-api")>();

  return { ...original, getCart: vi.fn(), updateCartItem: vi.fn() };
});

const customerId = "3296f1d5-5a1d-4b94-9caa-b26878f447e4";
const accessToken = "storefront-navigation-access-token";

function cart(totalQuantity: number, ownerId: string | null): ActiveCart {
  const total = (totalQuantity * 100).toFixed(2);
  const timestamp = "2026-09-08T12:00:00.000Z";
  const items: ActiveCart["items"] = totalQuantity === 0 ? [] : [{
    createdAt: timestamp,
    id: "f14df807-96bd-42bb-8929-e3d1f9d71316",
    product: {
      currency: "USD",
      id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
      image: {
        storageKey: "development/products/keyboard/cover.webp",
        url: "https://picsum.photos/id/60/1200/900.webp",
      },
      isAvailable: true,
      name: "Teclado Relay 75",
      price: "100.00",
      sku: "RELAY-075",
      stockAvailable: 10,
    },
    productId: "10184fd0-3dcb-47cf-af70-a8be4c765421",
    quantity: totalQuantity,
    subtotal: total,
    updatedAt: timestamp,
  }];

  return {
    createdAt: timestamp,
    currency: totalQuantity === 0 ? null : "USD",
    customerId: ownerId,
    id: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
    items,
    status: "ACTIVE",
    subtotal: total,
    total,
    totalQuantity,
    updatedAt: timestamp,
  };
}

function renderStorefront() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StorefrontShell>
        <main><h1>Tienda</h1></main>
      </StorefrontShell>
    </QueryClientProvider>,
  );
}

function renderStorefrontCart() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StorefrontShell><CartPage /></StorefrontShell>
    </QueryClientProvider>,
  );
}

const navigationScenarios = [
  { authenticated: false, totalQuantity: 0, expectedCount: "0 unidades" },
  { authenticated: false, totalQuantity: 4, expectedCount: "4 unidades" },
  { authenticated: true, totalQuantity: 0, expectedCount: "0 unidades" },
  { authenticated: true, totalQuantity: 5, expectedCount: "5 unidades" },
] as const;

describe("navegación persistente del storefront", () => {
  beforeEach(() => {
    vi.mocked(getCart).mockReset();
    vi.mocked(updateCartItem).mockReset();
    useSessionStore.setState({
      notice: null,
      session: null,
      status: "anonymous",
    });
  });

  it.each(navigationScenarios)(
    "muestra las acciones apropiadas y $expectedCount para $authenticated",
    async ({ authenticated, totalQuantity, expectedCount }) => {
      const session = authenticated
        ? {
            accessToken,
            accessTokenExpiresAt: "2026-09-08T12:15:00.000Z",
            sessionExpiresAt: "2026-09-15T12:00:00.000Z",
            tokenType: "Bearer" as const,
            user: {
              displayName: "Cliente Demo",
              email: "customer@example.com",
              id: customerId,
              role: "CUSTOMER" as const,
            },
          }
        : null;
      useSessionStore.setState({
        notice: null,
        session,
        status: authenticated ? "authenticated" : "anonymous",
      });
      vi.mocked(getCart).mockResolvedValue(cart(totalQuantity, authenticated ? customerId : null));

      renderStorefront();

      const accountNavigation = screen.getByRole("navigation", { name: "Cuenta y sesión" });
      expect(screen.getByRole("navigation", { name: "Navegación principal" })).toHaveTextContent("Inicio");
      expect(await screen.findByRole("link", { name: `Ver carrito, ${expectedCount}` })).toHaveAttribute("href", "/cart");

      if (authenticated) {
        expect(within(accountNavigation).getByRole("link", { name: "Mi cuenta" })).toHaveAttribute("href", "/account");
        expect(within(accountNavigation).getByRole("link", { name: "Mis compras" })).toHaveAttribute("href", "/account/orders");
        expect(within(accountNavigation).getByRole("link", { name: "Mis facturas" })).toHaveAttribute("href", "/account/invoices");
        expect(within(accountNavigation).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
        expect(within(accountNavigation).queryByRole("link", { name: "Ingresar" })).not.toBeInTheDocument();
        expect(getCart).toHaveBeenCalledWith(accessToken);
      } else {
        expect(within(accountNavigation).getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/login");
        expect(within(accountNavigation).getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/register");
        expect(within(accountNavigation).queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
        expect(getCart).toHaveBeenCalledWith(undefined);
      }
    },
  );

  it.each([
    { authenticated: false, ownerId: null },
    { authenticated: true, ownerId: customerId },
  ])("actualiza el badge tras cambiar cantidades como visitante o cliente ($authenticated)", async ({ authenticated, ownerId }) => {
    const session = authenticated
      ? {
          accessToken,
          accessTokenExpiresAt: "2026-09-08T12:15:00.000Z",
          sessionExpiresAt: "2026-09-15T12:00:00.000Z",
          tokenType: "Bearer" as const,
          user: {
            displayName: "Cliente Demo",
            email: "customer@example.com",
            id: customerId,
            role: "CUSTOMER" as const,
          },
        }
      : null;
    useSessionStore.setState({
      notice: null,
      session,
      status: authenticated ? "authenticated" : "anonymous",
    });
    vi.mocked(getCart).mockResolvedValue(cart(1, ownerId));
    vi.mocked(updateCartItem).mockResolvedValue(cart(3, ownerId));

    const user = userEvent.setup();
    renderStorefrontCart();

    expect(await screen.findByRole("link", { name: "Ver carrito, 1 unidad" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Aumentar cantidad de Teclado Relay 75" }));

    expect(await screen.findByRole("link", { name: "Ver carrito, 3 unidades" })).toHaveAttribute("href", "/cart");
    expect(updateCartItem).toHaveBeenCalledWith(
      authenticated ? accessToken : undefined,
      "f14df807-96bd-42bb-8929-e3d1f9d71316",
      2,
    );
  });
});
