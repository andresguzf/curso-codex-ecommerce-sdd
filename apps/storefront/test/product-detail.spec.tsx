import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductDetail as ProductDetailModel } from "@technology-ecommerce/api-schemas";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getPublicProduct,
  PublicProductNotFoundError,
} from "../src/features/catalog/catalog-api";
import { ProductDetail } from "../src/features/catalog/product-detail";

vi.mock("../src/features/catalog/catalog-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/features/catalog/catalog-api")>();

  return {
    ...original,
    getPublicProduct: vi.fn(),
  };
});

const availableProduct: ProductDetailModel = {
  availability: "IN_STOCK",
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Teclado mecánico de perfil compacto con iluminación configurable.",
  id: "10184fd0-3dcb-47cf-af70-a8be4c765421",
  image: {
    storageKey: "development/products/keyboard/cover.webp",
    url: "https://picsum.photos/id/60/1200/900.webp",
  },
  name: "Teclado Relay 75",
  price: "149.90",
  sku: "RELAY-075",
  status: "ACTIVE",
  stockAvailable: 8,
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
    expect(screen.getByRole("img", { name: "Teclado Relay 75" })).toBeInTheDocument();
    expect(screen.getByText(availableProduct.description)).toBeInTheDocument();
    expect(screen.getByText("US$149,90")).toBeInTheDocument();
    expect(screen.getByText("8 unidades disponibles")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar Teclado Relay 75 al carrito" })).toBeEnabled();
    expect(getPublicProduct).toHaveBeenCalledWith(availableProduct.id);
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
