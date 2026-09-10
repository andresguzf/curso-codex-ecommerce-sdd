import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveCart, ProductListItem, ProductPage } from "@technology-ecommerce/api-schemas";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { addCartItem, CartApiError, getCart } from "../src/features/cart/cart-api";
import { useCartUiStore } from "../src/features/cart/cart-ui-store";
import { CatalogLanding } from "../src/features/catalog/catalog-landing";
import { getPublicProducts } from "../src/features/catalog/catalog-api";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => navigation.searchParams,
}));

vi.mock("../src/features/catalog/catalog-api", () => ({
  getPublicProducts: vi.fn(),
}));

vi.mock("../src/features/cart/cart-api", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("../src/features/cart/cart-api")
  >();

  return {
    ...original,
    addCartItem: vi.fn(),
    getCart: vi.fn(),
  };
});

const productBase = {
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Producto tecnológico preparado para trabajo exigente.",
  image: {
    storageKey: "development/products/example/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  price: "499.90",
  updatedAt: "2026-09-04T12:00:00.000Z",
} as const;

function product(
  input: Pick<ProductListItem, "id" | "name" | "sku" | "status" | "stockAvailable">,
): ProductListItem {
  return { ...productBase, ...input };
}

function page(items: readonly ProductListItem[]): ProductPage {
  return {
    items: [...items],
    page: 1,
    pageSize: 9,
    totalItems: items.length,
    totalPages: items.length === 0 ? 0 : 1,
  };
}

function cart(productItem: ProductListItem): ActiveCart {
  return {
    createdAt: "2026-09-08T12:00:00.000Z",
    currency: productItem.currency,
    customerId: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
    id: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
    items: [{
      createdAt: "2026-09-08T12:01:00.000Z",
      id: "f14df807-96bd-42bb-8929-e3d1f9d71316",
      product: {
        currency: productItem.currency,
        id: productItem.id,
        image: productItem.image,
        isAvailable: true,
        name: productItem.name,
        price: productItem.price,
        sku: productItem.sku,
        stockAvailable: productItem.stockAvailable,
      },
      productId: productItem.id,
      quantity: 1,
      subtotal: productItem.price,
      updatedAt: "2026-09-08T12:01:00.000Z",
    }],
    status: "ACTIVE",
    subtotal: productItem.price,
    total: productItem.price,
    totalQuantity: 1,
    updatedAt: "2026-09-08T12:01:00.000Z",
  };
}

function renderCatalog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <CatalogLanding />
    </QueryClientProvider>
  );
  const rendered = render(ui);

  return {
    ...rendered,
    rerenderCatalog: () => rendered.rerender(ui),
  };
}

describe("storefront catalog landing", () => {
  beforeEach(() => {
    vi.mocked(addCartItem).mockReset();
    vi.mocked(getCart).mockReset();
    vi.mocked(getPublicProducts).mockReset();
    vi.mocked(getCart).mockResolvedValue({
      createdAt: "2026-09-08T12:00:00.000Z",
      currency: null,
      customerId: null,
      id: "f69d57cb-3473-4ee4-8474-5d71aefbcbe5",
      items: [],
      status: "ACTIVE",
      subtotal: "0.00",
      total: "0.00",
      totalQuantity: 0,
      updatedAt: "2026-09-08T12:00:00.000Z",
    });
    navigation.push.mockReset();
    navigation.searchParams = new URLSearchParams();
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
    useCartUiStore.setState({ notice: null, removalItemId: null });
  });

  it("renders the hero and only active products returned by the public catalog", async () => {
    vi.mocked(getPublicProducts).mockResolvedValue(page([
      product({
        id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
        name: "Monitor Studio 27",
        sku: "MONITOR-027",
        status: "ACTIVE",
        stockAvailable: 5,
      }),
      product({
        id: "076c5a64-7d8a-4d98-8d4c-347334d65aa7",
        name: "Producto interno",
        sku: "INACTIVE-001",
        status: "INACTIVE",
        stockAvailable: 4,
      }),
    ]));

    renderCatalog();

    expect(screen.getByRole("heading", { name: "El equipo correcto cambia tu ritmo." })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Monitor Studio 27" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Monitor Studio 27" })).toHaveAttribute(
      "href",
      "/products/10184fd0-3dcb-47cf-af70-a8be4c765421",
    );
    expect(screen.queryByText("Producto interno")).not.toBeInTheDocument();
    expect(getPublicProducts).toHaveBeenCalledWith({
      page: 1,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("disables the purchase action for an exhausted product", async () => {
    vi.mocked(getPublicProducts).mockResolvedValue(page([
      product({
        id: "0b130d30-ad61-45ca-b2c5-ff0c38701f1e",
        name: "Ultrabook Atlas",
        sku: "ATLAS-014",
        status: "ACTIVE",
        stockAvailable: 0,
      }),
      product({
        id: "62ac275e-bbf6-43ab-8885-e5588bd24c87",
        name: "Teclado Relay",
        sku: "RELAY-075",
        status: "ACTIVE",
        stockAvailable: 12,
      }),
    ]));

    renderCatalog();

    expect(await screen.findByRole("button", { name: "Agregar Ultrabook Atlas al carrito" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar Teclado Relay al carrito" })).toBeEnabled();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });

  it("adds an available product to the authenticated customer's cart", async () => {
    const availableProduct = product({
      id: "62ac275e-bbf6-43ab-8885-e5588bd24c87",
      name: "Teclado Relay",
      sku: "RELAY-075",
      status: "ACTIVE",
      stockAvailable: 12,
    });
    const updatedCart = cart(availableProduct);
    vi.mocked(getPublicProducts).mockResolvedValue(page([availableProduct]));
    vi.mocked(getCart).mockResolvedValue({
      ...updatedCart,
      currency: null,
      items: [],
      subtotal: "0.00",
      total: "0.00",
      totalQuantity: 0,
    });
    vi.mocked(addCartItem).mockResolvedValue(updatedCart);
    useSessionStore.setState({
      session: {
        accessToken: "storefront-access-token",
        accessTokenExpiresAt: "2026-09-08T12:15:00.000Z",
        sessionExpiresAt: "2026-09-15T12:00:00.000Z",
        tokenType: "Bearer",
        user: {
          displayName: "Cliente Demo",
          email: "customer@example.com",
          id: updatedCart.customerId!,
          role: "CUSTOMER",
        },
      },
      status: "authenticated",
    });
    const user = userEvent.setup();

    renderCatalog();
    await user.click(await screen.findByRole("button", {
      name: "Agregar Teclado Relay al carrito",
    }));

    expect(addCartItem).toHaveBeenCalledWith(
      "storefront-access-token",
      availableProduct.id,
      1,
    );
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/cart"));
    expect(useCartUiStore.getState().notice).toBe(
      "Teclado Relay fue agregado al carrito.",
    );
  });

  it("adds an available product to a visitor cart without redirecting to login", async () => {
    const availableProduct = product({
      id: "62ac275e-bbf6-43ab-8885-e5588bd24c87",
      name: "Teclado Relay",
      sku: "RELAY-075",
      status: "ACTIVE",
      stockAvailable: 12,
    });
    const updatedCart = { ...cart(availableProduct), customerId: null };
    vi.mocked(getPublicProducts).mockResolvedValue(page([availableProduct]));
    vi.mocked(getCart).mockResolvedValue({
      ...updatedCart,
      currency: null,
      items: [],
      subtotal: "0.00",
      total: "0.00",
      totalQuantity: 0,
    });
    vi.mocked(addCartItem).mockResolvedValue(updatedCart);
    const user = userEvent.setup();

    renderCatalog();
    const addButton = await screen.findByRole("button", {
      name: "Agregar Teclado Relay al carrito",
    });
    expect(addButton).toBeEnabled();
    await user.click(addButton);

    expect(addCartItem).toHaveBeenCalledWith(undefined, availableProduct.id, 1);
    expect(navigation.push).not.toHaveBeenCalledWith("/login");
    expect(navigation.push).toHaveBeenCalledWith("/cart");
    expect(useCartUiStore.getState().notice).toBe(
      "Teclado Relay fue agregado al carrito.",
    );
  });

  it("shows the current availability when stock changes", async () => {
    const availableProduct = product({
      id: "62ac275e-bbf6-43ab-8885-e5588bd24c87",
      name: "Teclado Relay",
      sku: "RELAY-075",
      status: "ACTIVE",
      stockAvailable: 12,
    });
    vi.mocked(getPublicProducts).mockResolvedValue(page([availableProduct]));
    vi.mocked(addCartItem).mockRejectedValue(new CartApiError(409, {
      code: "CART_INSUFFICIENT_STOCK",
      details: { availableQuantity: 4, requestedQuantity: 5 },
      message: "The requested quantity exceeds available inventory",
    }));
    const user = userEvent.setup();

    renderCatalog();
    await user.click(await screen.findByRole("button", {
      name: "Agregar Teclado Relay al carrito",
    }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Solo hay 4 unidades disponibles.",
    );
    expect(navigation.push).not.toHaveBeenCalledWith("/cart");
  });

  it("navigates with the hero search in the URL and resets the page", async () => {
    navigation.searchParams = new URLSearchParams("page=4");
    vi.mocked(getPublicProducts).mockResolvedValue(page([]));
    renderCatalog();
    await waitFor(() => expect(getPublicProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 4 })));

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el catálogo" }), {
      target: { value: " monitor " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar productos" }));

    expect(navigation.push).toHaveBeenCalledWith(
      "/?page=1&search=monitor",
      { scroll: false },
    );
  });

  it("restores search, filters, order and page from the URL on reload", async () => {
    navigation.searchParams = new URLSearchParams(
      "search=teclado&availability=IN_STOCK&minPrice=100&maxPrice=300&page=3&sortBy=price&sortOrder=asc",
    );
    vi.mocked(getPublicProducts).mockResolvedValue(page([]));

    renderCatalog();

    await waitFor(() => expect(getPublicProducts).toHaveBeenCalledWith({
      availability: "IN_STOCK",
      maxPrice: "300",
      minPrice: "100",
      page: 3,
      search: "teclado",
      sortBy: "price",
      sortOrder: "asc",
    }));
    expect(screen.getByRole("searchbox", { name: "Buscar en el catálogo" })).toHaveValue("teclado");
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    expect(screen.getByRole("combobox", { name: "Disponibilidad" })).toHaveValue("IN_STOCK");
    expect(screen.getByRole("combobox", { name: "Ordenar por" })).toHaveValue("price:asc");
  });

  it("writes filters and order to the URL and returns to page one", async () => {
    navigation.searchParams = new URLSearchParams("search=monitor&page=5");
    vi.mocked(getPublicProducts).mockResolvedValue(page([]));
    renderCatalog();
    await waitFor(() => expect(getPublicProducts).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Disponibilidad" }), {
      target: { value: "OUT_OF_STOCK" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Mínimo" }), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Máximo" }), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Ordenar por" }), {
      target: { value: "price:desc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(navigation.push).toHaveBeenCalledTimes(1);
    const [href, options] = navigation.push.mock.calls[0] as [string, { scroll: boolean }];
    const nextUrl = new URL(href, "http://localhost:3000");
    expect(Object.fromEntries(nextUrl.searchParams)).toEqual({
      availability: "OUT_OF_STOCK",
      maxPrice: "900",
      minPrice: "200",
      page: "1",
      search: "monitor",
      sortBy: "price",
      sortOrder: "desc",
    });
    expect(options).toEqual({ scroll: false });
  });

  it("requests the criteria restored by browser history navigation", async () => {
    navigation.searchParams = new URLSearchParams("search=monitor&page=2");
    vi.mocked(getPublicProducts).mockResolvedValue(page([]));
    const { rerenderCatalog } = renderCatalog();
    await waitFor(() => expect(getPublicProducts).toHaveBeenCalledWith(expect.objectContaining({
      page: 2,
      search: "monitor",
    })));

    navigation.searchParams = new URLSearchParams("search=teclado&page=1&sortBy=name&sortOrder=asc");
    rerenderCatalog();

    await waitFor(() => expect(getPublicProducts).toHaveBeenCalledWith(expect.objectContaining({
      page: 1,
      search: "teclado",
      sortBy: "name",
      sortOrder: "asc",
    })));
  });
});
