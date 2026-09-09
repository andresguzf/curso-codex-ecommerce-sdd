import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveCart } from "@technology-ecommerce/api-schemas";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCart,
  removeCartItem,
  updateCartItem,
} from "../src/features/cart/cart-api";
import { CartPage } from "../src/features/cart/cart-page";
import { CartShortcut } from "../src/features/cart/cart-shortcut";
import { useCartUiStore } from "../src/features/cart/cart-ui-store";
import { useSessionStore } from "../src/features/auth/session";

vi.mock("../src/features/cart/cart-api", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("../src/features/cart/cart-api")
  >();
  return {
    ...original,
    getCart: vi.fn(),
    removeCartItem: vi.fn(),
    updateCartItem: vi.fn(),
  };
});

const accessToken = "storefront-cart-access-token";
const customerId = "3296f1d5-5a1d-4b94-9caa-b26878f447e4";

function cart(quantity = 1, stockAvailable = 4): ActiveCart {
  const subtotal = `${quantity * 100}.00`;
  return {
    createdAt: "2026-09-08T12:00:00.000Z",
    currency: "USD",
    customerId,
    id: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
    items: [
      {
        createdAt: "2026-09-08T12:01:00.000Z",
        id: "f14df807-96bd-42bb-8929-e3d1f9d71316",
        product: {
          currency: "USD",
          id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
          image: {
            storageKey: "development/products/keyboard/cover.webp",
            url: "https://picsum.photos/id/60/1200/900.webp",
          },
          isAvailable: stockAvailable > 0,
          name: "Teclado Relay 75",
          price: "100.00",
          sku: "RELAY-075",
          stockAvailable,
        },
        productId: "10184fd0-3dcb-47cf-af70-a8be4c765421",
        quantity,
        subtotal,
        updatedAt: "2026-09-08T12:01:00.000Z",
      },
    ],
    status: "ACTIVE",
    subtotal,
    total: subtotal,
    totalQuantity: quantity,
    updatedAt: "2026-09-08T12:01:00.000Z",
  };
}

function emptyCart(): ActiveCart {
  return {
    ...cart(),
    currency: null,
    items: [],
    subtotal: "0.00",
    total: "0.00",
    totalQuantity: 0,
  };
}

function renderCart() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CartPage />
    </QueryClientProvider>,
  );
}

describe("storefront cart", () => {
  beforeEach(() => {
    vi.mocked(getCart).mockReset();
    vi.mocked(removeCartItem).mockReset();
    vi.mocked(updateCartItem).mockReset();
    useCartUiStore.setState({ notice: null, removalItemId: null });
    useSessionStore.setState({
      notice: null,
      session: {
        accessToken,
        accessTokenExpiresAt: "2026-09-08T12:15:00.000Z",
        sessionExpiresAt: "2026-09-15T12:00:00.000Z",
        tokenType: "Bearer",
        user: {
          displayName: "Cliente Demo",
          email: "customer@example.com",
          id: customerId,
          role: "CUSTOMER",
        },
      },
      status: "authenticated",
    });
  });

  it("renders product availability and authoritative totals", async () => {
    vi.mocked(getCart).mockResolvedValue(cart(2, 4));

    renderCart();

    expect(
      await screen.findByRole("heading", { name: "Teclado Relay 75" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 unidades disponibles")).toBeInTheDocument();
    expect(screen.getAllByText("$200.00")).toHaveLength(3);
    expect(screen.getByText("2", { selector: "output" })).toBeInTheDocument();
    expect(getCart).toHaveBeenCalledWith(accessToken);
  });

  it("renders and manages the anonymous visitor cart", async () => {
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
    vi.mocked(getCart).mockResolvedValue({ ...cart(), customerId: null });

    renderCart();

    expect(
      await screen.findByRole("heading", { name: "Teclado Relay 75" }),
    ).toBeInTheDocument();
    expect(getCart).toHaveBeenCalledWith(undefined);
    expect(screen.queryByText(/inicia sesión para ver/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continuar al checkout" })).toHaveAttribute(
      "href",
      "/checkout",
    );
  });

  it("keeps a visible cart shortcut synchronized with total units", async () => {
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
    vi.mocked(getCart).mockResolvedValue({ ...cart(3), customerId: null });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <CartShortcut />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("link", {
      name: "Ver carrito, 3 unidades",
    })).toHaveAttribute("href", "/cart");
  });

  it("updates quantity and totals from the REST mutation response", async () => {
    vi.mocked(getCart).mockResolvedValue(cart(1, 4));
    vi.mocked(updateCartItem).mockResolvedValue(cart(2, 4));
    const user = userEvent.setup();
    renderCart();

    await user.click(
      await screen.findByRole("button", {
        name: "Aumentar cantidad de Teclado Relay 75",
      }),
    );

    expect(updateCartItem).toHaveBeenCalledWith(
      accessToken,
      "f14df807-96bd-42bb-8929-e3d1f9d71316",
      2,
    );
    await waitFor(() => {
      expect(screen.getByText("2", { selector: "output" })).toBeInTheDocument();
      expect(screen.getAllByText("$200.00")).toHaveLength(3);
    });
    expect(
      screen.getByText("Cantidad y total actualizados."),
    ).toBeInTheDocument();
  });

  it("does not allow a quantity greater than current stock", async () => {
    vi.mocked(getCart).mockResolvedValue(cart(1, 1));
    renderCart();

    const increase = await screen.findByRole("button", {
      name: "Aumentar cantidad de Teclado Relay 75",
    });
    expect(increase).toBeDisabled();
    expect(screen.getByText("1 unidades disponibles")).toBeInTheDocument();
    expect(updateCartItem).not.toHaveBeenCalled();
  });

  it("cancels removal without sending a request", async () => {
    vi.mocked(getCart).mockResolvedValue(cart());
    const user = userEvent.setup();
    renderCart();

    await user.click(
      await screen.findByRole("button", { name: "Quitar del carrito" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "¿Quitar este producto?",
    });
    expect(dialog).toHaveTextContent("Teclado Relay 75");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(removeCartItem).not.toHaveBeenCalled();
  });

  it("removes a confirmed line and renders the returned empty cart", async () => {
    vi.mocked(getCart).mockResolvedValue(cart());
    vi.mocked(removeCartItem).mockResolvedValue(emptyCart());
    const user = userEvent.setup();
    renderCart();

    await user.click(
      await screen.findByRole("button", { name: "Quitar del carrito" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Quitar producto",
      }),
    );

    expect(removeCartItem).toHaveBeenCalledWith(
      accessToken,
      "f14df807-96bd-42bb-8929-e3d1f9d71316",
    );
    expect(
      await screen.findByRole("heading", { name: "Encuentra tu próximo equipo" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Producto eliminado del carrito.",
    );
  });
});
