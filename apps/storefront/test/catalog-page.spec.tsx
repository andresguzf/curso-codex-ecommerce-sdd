import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getActiveCategories, getActiveTags } from "@technology-ecommerce/api-client";
import type { ProductListItem, ProductPage } from "@technology-ecommerce/api-schemas";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CatalogPage } from "../src/features/catalog/catalog-page";
import { getPublicProducts } from "../src/features/catalog/catalog-api";

const navigation = vi.hoisted(() => ({
  pathname: "/products",
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

vi.mock("../src/features/cart/use-add-to-cart", () => ({
  useAddToCart: () => ({ addProduct: vi.fn(), isAdding: false }),
}));

vi.mock("../src/features/wishlist/wishlist-button", () => ({
  WishlistButton: () => null,
}));

vi.mock("@technology-ecommerce/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@technology-ecommerce/api-client")>(),
  getActiveCategories: vi.fn(),
  getActiveTags: vi.fn(),
}));

const fixtureCoverImage = {
  ...{
    storageKey: "development/products/keyboard/cover.webp",
    url: "https://picsum.photos/id/96/1200/900.webp",
  },
  id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", altText: "Portada de producto de ejemplo",
  isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null,
};

const exampleProduct: ProductListItem = {
  category: null,
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Teclado mecánico para trabajo y juego.",
  id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
  coverImage: fixtureCoverImage,
  image: {
    storageKey: "development/products/keyboard/cover.webp",
    url: "https://picsum.photos/id/96/1200/900.webp",
  },
  name: "Teclado Nova 75",
  price: "189.90",
  sku: "KEY-NOVA-75",
  slug: "teclado-nova-75",
  status: "ACTIVE",
  stockAvailable: 14,
  tags: [],
  updatedAt: "2026-09-04T12:00:00.000Z",
};

function productPage(
  page: number,
  totalItems: number,
  totalPages: number,
): ProductPage {
  return {
    items: [exampleProduct],
    page,
    pageSize: 12,
    totalItems,
    totalPages,
  };
}

function renderCatalogPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <CatalogPage />
    </QueryClientProvider>
  );
  const rendered = render(ui);

  return {
    ...rendered,
    rerenderCatalogPage: () => rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <CatalogPage />
      </QueryClientProvider>,
    ),
  };
}

describe("complete storefront catalog", () => {
  beforeEach(() => {
    vi.mocked(getPublicProducts).mockReset();
    vi.mocked(getActiveCategories).mockResolvedValue([]);
    vi.mocked(getActiveTags).mockResolvedValue([]);
    navigation.push.mockReset();
    navigation.searchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requests the combined URL criteria as one backend page and renders its metadata", async () => {
    navigation.searchParams = new URLSearchParams(
      "search=teclado&availability=IN_STOCK&categoryId=553c237f-d1a5-4e98-b7c5-e67415724cf2&tagIds=16875593-f79f-45fd-b642-fc4e13154519&minPrice=100&maxPrice=300&page=2&sortBy=price&sortOrder=asc",
    );
    vi.mocked(getPublicProducts).mockResolvedValue(productPage(2, 25, 3));

    renderCatalogPage();

    expect(await screen.findByRole("heading", { name: "Teclado Nova 75" })).toBeInTheDocument();
    expect(getPublicProducts).toHaveBeenCalledWith({
      availability: "IN_STOCK",
      categoryId: "553c237f-d1a5-4e98-b7c5-e67415724cf2",
      tagIds: ["16875593-f79f-45fd-b642-fc4e13154519"],
      maxPrice: "300",
      minPrice: "100",
      page: 2,
      search: "teclado",
      sortBy: "price",
      sortOrder: "asc",
    }, 12);
    expect(screen.getByRole("status")).toHaveTextContent("25 productos encontrados");
    const pagination = screen.getByRole("navigation", { name: "Paginación del catálogo" });
    expect(within(pagination).getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar en todos los productos" })).toHaveValue("teclado");
  });

  it("starts at the backend's first page and preserves criteria when moving to an intermediate page", async () => {
    const user = userEvent.setup();
    navigation.searchParams = new URLSearchParams("search=monitor&availability=IN_STOCK&sortBy=price&sortOrder=asc");
    vi.mocked(getPublicProducts)
      .mockResolvedValueOnce(productPage(1, 37, 4))
      .mockResolvedValueOnce(productPage(2, 37, 4));

    const view = renderCatalogPage();
    expect(await screen.findByRole("heading", { name: "Teclado Nova 75" })).toBeInTheDocument();
    expect(getPublicProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 1, search: "monitor" }), 12);
    expect(within(screen.getByRole("navigation", { name: "Paginación del catálogo" })).getByText("Página 1 de 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ir a la página 2" }));
    const [nextUrl, options] = navigation.push.mock.calls[0] as [string, { scroll: boolean }];
    expect(Object.fromEntries(new URL(nextUrl, "http://localhost:3000").searchParams)).toEqual({
      page: "2",
      search: "monitor",
      availability: "IN_STOCK",
      sortBy: "price",
      sortOrder: "asc",
    });
    expect(options).toEqual({ scroll: false });

    navigation.searchParams = new URL(nextUrl, "http://localhost:3000").searchParams;
    view.rerenderCatalogPage();
    await waitFor(() => expect(getPublicProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, search: "monitor", availability: "IN_STOCK", sortBy: "price", sortOrder: "asc" }),
      12,
    ));
    const updatedPagination = await screen.findByRole("navigation", { name: "Paginación del catálogo" });
    expect(within(updatedPagination).getByText("Página 2 de 4")).toBeInTheDocument();
  });

  it("applies search and filter/order changes on page one", async () => {
    navigation.searchParams = new URLSearchParams("page=5&search=teclado&availability=IN_STOCK&sortBy=price&sortOrder=asc");
    vi.mocked(getPublicProducts).mockResolvedValue(productPage(5, 80, 7));
    const view = renderCatalogPage();
    await screen.findByRole("heading", { name: "Teclado Nova 75" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en todos los productos" }), {
      target: { value: " monitor " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      "/products?page=1&search=monitor&availability=IN_STOCK&sortBy=price&sortOrder=asc",
      { scroll: false },
    );

    navigation.searchParams = new URL(navigation.push.mock.calls.at(-1)?.[0] as string, "http://localhost:3000").searchParams;
    view.rerenderCatalogPage();
    await waitFor(() => expect(getPublicProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: "monitor", availability: "IN_STOCK" }),
      12,
    ));
    fireEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
    const filters = within(screen.getByRole("dialog", { name: "Filtros del catálogo" }));
    fireEvent.change(filters.getByRole("combobox", { name: "Disponibilidad" }), {
      target: { value: "OUT_OF_STOCK" },
    });
    fireEvent.change(filters.getByRole("combobox", { name: "Ordenar por" }), {
      target: { value: "name:asc" },
    });
    fireEvent.click(filters.getByRole("button", { name: "Aplicar" }));

    expect(navigation.push).toHaveBeenLastCalledWith(
      "/products?page=1&search=monitor&availability=OUT_OF_STOCK&sortBy=name&sortOrder=asc",
      { scroll: false },
    );
  });

  it("restores the requested page from the URL after the page is reloaded", async () => {
    navigation.searchParams = new URLSearchParams("page=3&search=monitor&sortBy=name&sortOrder=asc");
    vi.mocked(getPublicProducts).mockResolvedValue(productPage(3, 25, 3));

    const firstLoad = renderCatalogPage();
    expect(await screen.findByRole("heading", { name: "Teclado Nova 75" })).toBeInTheDocument();
    expect(getPublicProducts).toHaveBeenCalledWith(expect.objectContaining({ page: 3, search: "monitor", sortBy: "name", sortOrder: "asc" }), 12);
    firstLoad.unmount();

    renderCatalogPage();
    expect(await screen.findByRole("heading", { name: "Teclado Nova 75" })).toBeInTheDocument();
    expect(getPublicProducts).toHaveBeenCalledTimes(2);
    expect(getPublicProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, search: "monitor", sortBy: "name", sortOrder: "asc" }), 12);
  });
});
