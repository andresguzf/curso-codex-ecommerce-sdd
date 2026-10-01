import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductDetail as ProductDetailModel } from "@technology-ecommerce/api-schemas";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPublicProduct,
  PublicProductNotFoundError,
} from "../src/features/catalog/catalog-api";
import { ProductDetail } from "../src/features/catalog/product-detail";

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/10184fd0-3dcb-47cf-af70-a8be4c765421",
  useRouter: () => ({ push: vi.fn() }),
}));

const cartAction = vi.hoisted(() => ({
  addProduct: vi.fn(),
}));

vi.mock("../src/features/cart/use-add-to-cart", () => ({
  useAddToCart: () => ({
    addProduct: cartAction.addProduct,
    isAdding: false,
    isSessionInitializing: false,
  }),
}));

vi.mock("../src/features/catalog/catalog-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/features/catalog/catalog-api")>();

  return {
    ...original,
    getPublicProduct: vi.fn(),
  };
});

const fixtureCoverImage = {
  ...{
    storageKey: "development/products/keyboard/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", altText: "Portada de producto de ejemplo",
  isPrimary: true, sortOrder: 0, width: null, height: null, mimeType: null,
};

const availableProduct: ProductDetailModel = {
  availability: "IN_STOCK",
  images: [fixtureCoverImage],
  category: null,
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Teclado mecánico de perfil compacto con iluminación configurable.",
  id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
  coverImage: fixtureCoverImage,
  image: {
    storageKey: "development/products/keyboard/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  name: "Teclado Relay 75",
  price: "149.90",
  sku: "RELAY-075",
  slug: "teclado-relay-75",
  status: "ACTIVE",
  stockAvailable: 8,
  tags: [],
  updatedAt: "2026-09-04T12:00:00.000Z",
};

function renderDetail(productId = availableProduct.id) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductDetail productId={productId} />
    </QueryClientProvider>,
  );
}

describe("storefront product detail", () => {
  beforeEach(() => {
    cartAction.addProduct.mockReset();
    vi.mocked(getPublicProduct).mockReset();
  });

  it("shows a loading state while the REST detail is pending", () => {
    vi.mocked(getPublicProduct).mockImplementation(() => new Promise(() => undefined));

    renderDetail();

    expect(screen.getByText("Cargando detalle del producto…")).toBeInTheDocument();
  });

  it("renders image, description, price and available stock", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue(availableProduct);

    renderDetail();

    expect(await screen.findByRole("heading", { name: "Teclado Relay 75" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: fixtureCoverImage.altText })).toBeInTheDocument();
    expect(screen.getByText(availableProduct.description)).toBeInTheDocument();
    expect(screen.getByText("$149.90")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveClass("bg-[var(--ds-surface)]");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByText("8 unidades disponibles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar Teclado Relay 75 al carrito" })).toBeEnabled();
    expect(getPublicProduct).toHaveBeenCalledWith(availableProduct.id);
  });

  it("shows the product category and every active tag with catalog filter links", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue({
      ...availableProduct,
      category: { id: "553c237f-d1a5-4e98-b7c5-e67415724cf2", name: "Periféricos", slug: "perifericos", status: "ACTIVE" },
      tags: [
        { id: "16875593-f79f-45fd-b642-fc4e13154519", name: "Gaming", slug: "gaming", status: "ACTIVE" },
        { id: "4052c829-2ac3-42ab-b9dc-cf322dd85c2b", name: "RGB", slug: "rgb", status: "ACTIVE" },
      ],
    });

    renderDetail();

    expect(await screen.findByRole("link", { name: "Periféricos" })).toHaveAttribute("href", "/products?page=1&categoryId=553c237f-d1a5-4e98-b7c5-e67415724cf2");
    expect(screen.getByRole("link", { name: "Ver productos con la etiqueta Gaming" })).toHaveAttribute("href", "/products?page=1&tagIds=16875593-f79f-45fd-b642-fc4e13154519");
    expect(screen.getByRole("link", { name: "Ver productos con la etiqueta RGB" })).toBeInTheDocument();
  });

  it("explains absent classifications without linking inactive ones", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue({
      ...availableProduct,
      category: { id: "553c237f-d1a5-4e98-b7c5-e67415724cf2", name: "Archivada", slug: "archivada", status: "INACTIVE" },
      tags: [{ id: "16875593-f79f-45fd-b642-fc4e13154519", name: "Antigua", slug: "antigua", status: "INACTIVE" }],
    });

    renderDetail();

    expect(await screen.findByText("Sin categoría asignada")).toBeInTheDocument();
    expect(screen.getByText("Sin etiquetas asignadas")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Archivada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver productos con la etiqueta Antigua" })).not.toBeInTheDocument();
  });

  it("connects the detail purchase action to the cart mutation", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue(availableProduct);

    renderDetail();
    fireEvent.click(await screen.findByRole("button", {
      name: "Agregar Teclado Relay 75 al carrito",
    }));

    expect(cartAction.addProduct).toHaveBeenCalledWith(availableProduct);
  });

  it.each(["inexistente", "inactivo"])(
    "does not expose an %s product",
    async () => {
      vi.mocked(getPublicProduct).mockRejectedValue(new PublicProductNotFoundError());

      renderDetail();

      expect(await screen.findByRole("heading", { name: "Producto no disponible" })).toBeInTheDocument();
      expect(screen.getByText("Este producto no existe o ya no está activo en nuestro catálogo.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Agregar/ })).not.toBeInTheDocument();
    },
  );

  it("shows an exhausted active product and disables its purchase action", async () => {
    vi.mocked(getPublicProduct).mockResolvedValue({
      ...availableProduct,
      availability: "OUT_OF_STOCK",
      stockAvailable: 0,
    });

    renderDetail();

    expect(await screen.findByText("Agotado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar Teclado Relay 75 al carrito" })).toBeDisabled();
  });

  it("offers a retry when the API cannot load the detail", async () => {
    vi.mocked(getPublicProduct).mockRejectedValue(new Error("network unavailable"));

    renderDetail();

    expect(await screen.findByText("Comprueba que la API esté disponible y vuelve a intentarlo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intentar nuevamente" })).toBeInTheDocument();
  });
});
