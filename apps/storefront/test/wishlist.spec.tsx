import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveCart, AuthSession, WishlistPage as WishlistPageData } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { CartApiError, addCartItem, getCart } from "../src/features/cart/cart-api";
import { CartShortcut } from "../src/features/cart/cart-shortcut";
import { WishlistPage } from "../src/features/wishlist/wishlist-page";
import { WishlistButton } from "../src/features/wishlist/wishlist-button";
import { addWishlistItem, getWishlistPage, getWishlistProductIds, removeWishlistItem } from "../src/features/wishlist/wishlist-api";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/products/10184fd0-3dcb-47cf-af70-a8be4c765421",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => navigation.params,
}));
vi.mock("../src/features/wishlist/wishlist-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/wishlist/wishlist-api")>(),
  addWishlistItem: vi.fn(),
  getWishlistPage: vi.fn(),
  getWishlistProductIds: vi.fn(),
  removeWishlistItem: vi.fn(),
}));
vi.mock("../src/features/cart/cart-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/cart/cart-api")>(),
  addCartItem: vi.fn(),
  getCart: vi.fn(),
}));

const productId = "10184fd0-3dcb-47cf-af70-a8be4c765421";
const session: AuthSession = {
  accessToken: "wishlist-test-token",
  accessTokenExpiresAt: "2026-09-28T12:15:00.000Z",
  sessionExpiresAt: "2026-09-30T12:15:00.000Z",
  tokenType: "Bearer",
  user: { displayName: "Cliente", email: "cliente@example.com", id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", role: "CUSTOMER" },
};

function cart(quantity: number): ActiveCart {
  const createdAt = "2026-09-28T12:00:00.000Z";
  return {
    id: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
    customerId: session.user.id,
    status: "ACTIVE",
    items: quantity ? [{
      id: "29f682be-5d51-4e6b-9db2-af95857e863a",
      productId,
      product: { id: productId, sku: "RELAY-075", name: "Teclado Relay 75", price: "149.90", currency: "USD", image: { storageKey: "test/relay.webp", url: "https://picsum.photos/id/60/1200/900.webp" }, stockAvailable: 5, isAvailable: true },
      quantity,
      subtotal: "149.90",
      createdAt,
      updatedAt: createdAt,
    }] : [],
    totalQuantity: quantity,
    currency: quantity ? "USD" : null,
    subtotal: quantity ? "149.90" : "0.00",
    total: quantity ? "149.90" : "0.00",
    createdAt,
    updatedAt: createdAt,
  };
}

function page(isAvailable: boolean, status: "ACTIVE" | "INACTIVE" = "ACTIVE"): WishlistPageData {
  return {
    page: 1, pageSize: 12, totalItems: 1, totalPages: 1,
    items: [{
      id: "f14df807-96bd-42bb-8929-e3d1f9d71316",
      productId,
      createdAt: "2026-09-28T12:00:00.000Z",
      productStatus: status,
      productDeletedAt: null,
      product: { id: productId, name: "Teclado Relay 75", slug: "teclado-relay-75", price: "149.90", currency: "USD", image: null, stockAvailable: isAvailable ? 5 : 0, isAvailable },
    }],
  };
}

function renderWithQueries(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}>{element}<FlashRegion appearance="storefront" /></QueryClientProvider>) };
}

describe("customer wishlist UI", () => {
  beforeEach(() => {
    vi.mocked(addWishlistItem).mockReset();
    vi.mocked(removeWishlistItem).mockReset();
    vi.mocked(getWishlistPage).mockReset();
    vi.mocked(getWishlistProductIds).mockReset();
    vi.mocked(addCartItem).mockReset();
    vi.mocked(getCart).mockReset();
    vi.mocked(getCart).mockResolvedValue(cart(0));
    navigation.push.mockReset();
    navigation.replace.mockReset();
    navigation.params = new URLSearchParams();
    useSessionStore.setState({ session, status: "authenticated" });
    useFlashStore.getState().dismissFlash();
  });

  it("saves from a product card, invalidates membership and reports success", async () => {
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set());
    vi.mocked(addWishlistItem).mockResolvedValue(true);
    const { client } = renderWithQueries(<WishlistButton productId={productId} productName="Teclado Relay 75" />);
    const invalidation = vi.spyOn(client, "invalidateQueries");
    const saveButton = screen.getByRole("button", { name: "Guardar Teclado Relay 75 en deseos" });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    await waitFor(() => expect(addWishlistItem).toHaveBeenCalledWith("wishlist-test-token", productId));
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["wishlist", session.user.id] }));
    expect(await screen.findByText("Teclado Relay 75 guardado en tus deseos.")).toBeInTheDocument();
  });

  it("confirms removal of a saved product and invalidates its page", async () => {
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set([productId]));
    vi.mocked(removeWishlistItem).mockResolvedValue();
    const { client } = renderWithQueries(<WishlistButton productId={productId} productName="Teclado Relay 75" />);
    const invalidation = vi.spyOn(client, "invalidateQueries");
    fireEvent.click(await screen.findByRole("button", { name: "Quitar Teclado Relay 75 de deseos" }));
    expect(screen.getByRole("dialog", { name: "¿Quitar este producto?" })).toBeInTheDocument();
    expect(removeWishlistItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar de deseos" }));
    await waitFor(() => expect(removeWishlistItem).toHaveBeenCalledWith("wishlist-test-token", productId));
    await waitFor(() => expect(invalidation).toHaveBeenCalledWith({ queryKey: ["wishlist", session.user.id] }));
    expect(await screen.findByText("Teclado Relay 75 eliminado de tus deseos.")).toBeInTheDocument();
  });

  it("keeps the saved wish when removal is cancelled", async () => {
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set([productId]));
    renderWithQueries(<WishlistButton productId={productId} productName="Teclado Relay 75" />);
    fireEvent.click(await screen.findByRole("button", { name: "Quitar Teclado Relay 75 de deseos" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(removeWishlistItem).not.toHaveBeenCalled();
  });

  it("reports an unsuccessful save without changing membership", async () => {
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set());
    vi.mocked(addWishlistItem).mockRejectedValue(new Error("network"));
    renderWithQueries(<WishlistButton productId={productId} productName="Teclado Relay 75" />);
    const saveButton = screen.getByRole("button", { name: "Guardar Teclado Relay 75 en deseos" });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);
    expect(await screen.findByText("No pudimos guardar el producto. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(saveButton).toHaveAttribute("aria-pressed", "false");
  });

  it("redirects a visitor to login without calling the private API", () => {
    useSessionStore.setState({ session: null, status: "anonymous" });
    renderWithQueries(<WishlistButton productId={productId} productName="Teclado Relay 75" />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar Teclado Relay 75 en deseos" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("/login?returnTo="));
    expect(getWishlistProductIds).not.toHaveBeenCalled();
  });

  it("redirects an anonymous wishlist visitor while preserving the requested page", async () => {
    useSessionStore.setState({ session: null, status: "anonymous" });
    navigation.params = new URLSearchParams({ page: "2" });
    renderWithQueries(<WishlistPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login?returnTo=%2Faccount%2Fwishlist%3Fpage%3D2"));
    expect(getWishlistPage).not.toHaveBeenCalled();
  });

  it.each([
    [false, "ACTIVE", "Agotado por ahora"],
    [false, "INACTIVE", "Ya no está en catálogo"],
    [true, "ACTIVE", "5 disponibles"],
  ] as const)("shows availability %s/%s without hiding the wish", async (available, status, label) => {
    vi.mocked(getWishlistPage).mockResolvedValue(page(available, status));
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set([productId]));
    renderWithQueries(<WishlistPage />);
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Teclado Relay 75" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Quitar Teclado Relay 75 de deseos" })).toBeInTheDocument();
    const purchase = screen.getByRole("button", { name: "Agregar Teclado Relay 75 al carrito desde deseos" });
    expect(purchase).toHaveProperty("disabled", !available);
    if (status === "INACTIVE") expect(screen.queryByRole("link", { name: "Ver producto" })).not.toBeInTheDocument();
  });

  it("adds an available wish to the cart, updates the badge and keeps the wish", async () => {
    vi.mocked(getWishlistPage).mockResolvedValue(page(true));
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set([productId]));
    vi.mocked(addCartItem).mockResolvedValue(cart(1));
    renderWithQueries(<><CartShortcut /><WishlistPage /></>);

    expect(await screen.findByRole("link", { name: "Ver carrito, 0 unidades" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Agregar Teclado Relay 75 al carrito desde deseos" }));

    await waitFor(() => expect(addCartItem).toHaveBeenCalledWith("wishlist-test-token", productId, 1));
    expect(await screen.findByRole("link", { name: "Ver carrito, 1 unidad" })).toBeInTheDocument();
    expect(await screen.findByText("Teclado Relay 75 fue agregado al carrito.")).toBeInTheDocument();
    expect(navigation.push).toHaveBeenCalledWith("/cart");
    expect(screen.getByRole("heading", { name: "Teclado Relay 75" })).toBeInTheDocument();
    expect(removeWishlistItem).not.toHaveBeenCalled();
  });

  it("revalidates a wish when stock changes and does not remove or navigate", async () => {
    vi.mocked(getWishlistPage).mockResolvedValueOnce(page(true)).mockResolvedValue(page(false));
    vi.mocked(getWishlistProductIds).mockResolvedValue(new Set([productId]));
    vi.mocked(addCartItem).mockRejectedValue(new CartApiError(409, {
      code: "CART_INSUFFICIENT_STOCK",
      details: { availableQuantity: 0, requestedQuantity: 1 },
    }));
    renderWithQueries(<><CartShortcut /><WishlistPage /></>);
    fireEvent.click(await screen.findByRole("button", { name: "Agregar Teclado Relay 75 al carrito desde deseos" }));

    expect(await screen.findByText("Solo hay 0 unidades disponibles.")).toBeInTheDocument();
    expect(await screen.findByText("Agotado por ahora")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar Teclado Relay 75 al carrito desde deseos" })).toBeDisabled();
    expect(screen.getByRole("heading", { name: "Teclado Relay 75" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver carrito, 0 unidades" })).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
    expect(removeWishlistItem).not.toHaveBeenCalled();
  });
});
