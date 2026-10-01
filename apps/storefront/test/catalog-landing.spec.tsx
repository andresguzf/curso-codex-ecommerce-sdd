import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ActiveCart, CatalogLanding as LandingComposition, ProductListItem } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { addCartItem, CartApiError, getCart } from "../src/features/cart/cart-api";
import { CatalogLanding } from "../src/features/catalog/catalog-landing";
import { getCatalogLanding } from "../src/features/catalog/catalog-api";

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
  getCatalogLanding: vi.fn(),
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

const fixtureCoverImage = {
  ...{
    storageKey: "development/products/example/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", altText: "Portada de producto de ejemplo",
  isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null,
};

const productBase = {
  category: null,
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Producto tecnológico preparado para trabajo exigente.",
  coverImage: fixtureCoverImage,
  image: {
    storageKey: "development/products/example/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  price: "499.90",
  slug: "producto-ejemplo",
  tags: [],
  updatedAt: "2026-09-04T12:00:00.000Z",
} as const;

function product(
  input: Pick<ProductListItem, "id" | "name" | "sku" | "status" | "stockAvailable">,
): ProductListItem {
  return { ...productBase, ...input, tags: [] };
}

function page(items: readonly ProductListItem[]): LandingComposition {
  return {
    featuredProducts: [],
    latestProducts: items as LandingComposition["latestProducts"],
    highlightedCategories: [],
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
      <FlashRegion appearance="storefront" />
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
    vi.mocked(getCatalogLanding).mockReset();
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
    useFlashStore.getState().dismissFlash();
  });

  it("renders the hero and only active products returned by the public catalog", async () => {
    vi.mocked(getCatalogLanding).mockResolvedValue(page([
      product({
        id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
        name: "Monitor Studio 27",
        sku: "MONITOR-027",
        status: "ACTIVE",
        stockAvailable: 5,
      }),
    ]));

    renderCatalog();

    expect(screen.getByRole("heading", { name: "El equipo correcto cambia tu ritmo." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los productos" })).toHaveAttribute("href", "/products");
    expect(await screen.findByRole("heading", { name: "Monitor Studio 27" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Monitor Studio 27" })).toHaveAttribute(
      "href",
      "/products/10184fd0-3dcb-47cf-af70-a8be4c765421",
    );
    expect(screen.queryByText("Producto interno")).not.toBeInTheDocument();
    expect(getCatalogLanding).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(screen.queryByRole("button", { name: /Filtros/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /paginación/i })).not.toBeInTheDocument();
  });

  it("shows category and tag links on a classified product card", async () => {
    vi.mocked(getCatalogLanding).mockResolvedValue(page([{
      ...product({
        id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
        name: "Monitor Studio 27",
        sku: "MONITOR-027",
        status: "ACTIVE",
        stockAvailable: 5,
      }),
      category: { id: "553c237f-d1a5-4e98-b7c5-e67415724cf2", name: "Monitores", slug: "monitores", status: "ACTIVE" },
      tags: [{ id: "16875593-f79f-45fd-b642-fc4e13154519", name: "4K", slug: "4k", status: "ACTIVE" }],
    }]));

    renderCatalog();

    expect(await screen.findByRole("link", { name: "Ver productos de la categoría Monitores" })).toHaveAttribute("href", "/products?page=1&categoryId=553c237f-d1a5-4e98-b7c5-e67415724cf2");
    expect(screen.getByRole("link", { name: "Ver productos con la etiqueta 4K" })).toHaveAttribute("href", "/products?page=1&tagIds=16875593-f79f-45fd-b642-fc4e13154519");
  });

  it("disables the purchase action for an exhausted product", async () => {
    vi.mocked(getCatalogLanding).mockResolvedValue(page([
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
    vi.mocked(getCatalogLanding).mockResolvedValue(page([availableProduct]));
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
    expect(useFlashStore.getState().flash).toEqual({
      tone: "success", message: "Teclado Relay fue agregado al carrito.",
    });
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
    vi.mocked(getCatalogLanding).mockResolvedValue(page([availableProduct]));
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
    expect(useFlashStore.getState().flash).toEqual({
      tone: "success", message: "Teclado Relay fue agregado al carrito.",
    });
  });

  it("shows the current availability when stock changes", async () => {
    const availableProduct = product({
      id: "62ac275e-bbf6-43ab-8885-e5588bd24c87",
      name: "Teclado Relay",
      sku: "RELAY-075",
      status: "ACTIVE",
      stockAvailable: 12,
    });
    vi.mocked(getCatalogLanding).mockResolvedValue(page([availableProduct]));
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

    expect(await screen.findByText("Solo hay 4 unidades disponibles.")).toBeInTheDocument();
    expect(useFlashStore.getState().flash?.tone).toBe("error");
    expect(navigation.push).not.toHaveBeenCalledWith("/cart");
  });

  it("navigates with the hero search in the URL and resets the page", async () => {
    navigation.searchParams = new URLSearchParams("page=4&availability=OUT_OF_STOCK&minPrice=100");
    vi.mocked(getCatalogLanding).mockResolvedValue(page([]));
    renderCatalog();
    await waitFor(() => expect(getCatalogLanding).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en el catálogo" }), {
      target: { value: " monitor " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar productos" }));

    expect(navigation.push).toHaveBeenCalledWith("/products?page=1&search=monitor", { scroll: true });
    expect(screen.getByRole("region", { name: "Lo último en tecnología" })).toHaveAttribute("id", "catalog");
  });


  it("ignores legacy URL criteria and preserves the nine recent products in backend order", async () => {
    navigation.searchParams = new URLSearchParams("search=teclado&page=8&availability=OUT_OF_STOCK&sortBy=price");
    const items = Array.from({ length: 9 }, (_, index) => product({
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name: `Reciente ${index}`, sku: `RECENT-${index}`, status: "ACTIVE", stockAvailable: 5,
    }));
    vi.mocked(getCatalogLanding).mockResolvedValue({
      ...page(items),
      featuredProducts: [{ ...page(items).latestProducts[0]!, id: "62ac275e-bbf6-43ab-8885-e5588bd24c87", name: "Destacado separado" }],
    });
    renderCatalog();
    await screen.findByRole("heading", { name: "Reciente 0" });
    expect(screen.getAllByRole("heading", { name: /Reciente \d/ }).map((heading) => heading.textContent)).toEqual(items.map((item) => item.name));
    expect(screen.queryByText("Destacado separado")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-slot="product-card"]')).toHaveLength(9);
    expect(screen.getByRole("searchbox", { name: "Buscar en el catálogo" })).toHaveValue("");
    expect(getCatalogLanding).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filtros|página/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los productos" })).toHaveAttribute("href", "/products");
  });

  it("shows an explicit empty state without encouraging filters", async () => {
    vi.mocked(getCatalogLanding).mockResolvedValue(page([]));
    renderCatalog();
    expect(await screen.findByRole("heading", { name: "Todavía no hay novedades" })).toBeInTheDocument();
    expect(screen.queryByText("Prueba con una búsqueda más amplia.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todos los productos" })).toBeInTheDocument();
  });

  it("shows loading, safe errors and a working retry without changing the URL", async () => {
    let rejectRequest!: (error: Error) => void;
    vi.mocked(getCatalogLanding).mockImplementationOnce(() => new Promise((_, reject) => { rejectRequest = reject; }));
    renderCatalog();
    expect(screen.getByText("Cargando novedades…")).toBeInTheDocument();
    rejectRequest(new Error("Internal database details"));
    expect(await screen.findByText("No pudimos cargar las novedades. Inténtalo nuevamente o explora todos los productos.")).toBeInTheDocument();
    expect(screen.queryByText("Internal database details")).not.toBeInTheDocument();
    vi.mocked(getCatalogLanding).mockResolvedValue(page([]));
    await userEvent.setup().click(screen.getByRole("button", { name: "Intentar nuevamente" }));
    expect(await screen.findByRole("heading", { name: "Todavía no hay novedades" })).toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
