import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthRole, CatalogImage, ProductDetail } from "@technology-ecommerce/api-schemas";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductGalleryPanel } from "../src/features/products/product-gallery-panel";
import { getAdministrativeProductGallery, ProductImageApiError } from "../src/features/products/product-image-api";

vi.mock("../src/features/products/product-image-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/products/product-image-api")>(), getAdministrativeProductGallery: vi.fn(),
}));
const productId = "4dff7cda-b8e6-459d-b187-dc6fb8f2582c";
const image = (index: number, primary = index === 0): CatalogImage => ({
  id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  storageKey: `products/${index}.png`, url: `https://example.com/${index}.png`,
  altText: `Vista ${index + 1}`, isPrimary: primary, sortOrder: index,
  width: 800, height: 600, mimeType: "image/png",
});
const detail = (images: CatalogImage[]): ProductDetail => ({
  id: productId, sku: "KEY-01", name: "Teclado", slug: "teclado", description: "Teclado mecánico",
  price: "89.00", currency: "USD", status: "INACTIVE" as const, category: null, tags: [],
  image: { storageKey: "placeholder", url: "/images/product-placeholder.svg" },
  coverImage: images.find((entry) => entry.isPrimary) ?? null, images, stockAvailable: 0,
  availability: "OUT_OF_STOCK" as const, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z",
});
function session(role: AuthRole = "ADMIN", id = "admin-1") {
  useSessionStore.setState({ status: "authenticated", session: {
    accessToken: `${id}-token`, tokenType: "Bearer", accessTokenExpiresAt: "2026-10-01T13:00:00.000Z",
    sessionExpiresAt: "2026-10-08T12:00:00.000Z", user: { id, role, email: `${id}@example.com`, displayName: id },
  } });
}
function show(product = productId, theme = "light") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><div data-design-system="backoffice" data-theme={theme}><ProductGalleryPanel productId={product || undefined} /></div></QueryClientProvider>);
  return { ...view, client };
}

describe("administrative product gallery panel", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => { vi.clearAllMocks(); session(); vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail([image(0)])); });

  it("does not query before the product is created", () => {
    show("");
    expect(screen.getByText(/Guarda primero el producto/)).toBeInTheDocument();
    expect(getAdministrativeProductGallery).not.toHaveBeenCalled();
    expect(screen.queryByText(/\/4 imágenes/)).not.toBeInTheDocument();
  });

  it("resolves same-origin media when the public API base is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    const key = "a1bad9a3-59e8-491c-a0cd-ffa76c3ec8ef.png";
    vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail([
      { ...image(0), storageKey: key, url: `/api/v1/media/images/${key}` },
    ]));
    show();
    const thumbnail = await screen.findByRole("img", { name: "Vista 1" });
    expect(thumbnail).toHaveAttribute("src", `${window.location.origin}/api/v1/media/images/${key}`);
  });

  it.each(["light", "dark"])("shows ordered miniatures and the selected cover using semantic tokens in %s", async (theme) => {
    vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail([image(0, false), image(1, true), image(2, false), image(3, false)]));
    show(productId, theme);
    const panel = await screen.findByRole("region", { name: "Galería de imágenes" });
    expect(await screen.findByLabelText("4 de 4 imágenes")).toBeInTheDocument();
    const cards = within(panel).getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    cards.forEach((card, index) => {
      expect(within(card).getByText(`Posición ${index + 1}`)).toBeInTheDocument();
      expect(within(card).getByRole("img", { name: `Vista ${index + 1}` })).toHaveAttribute("loading", "lazy");
    });
    expect(within(cards[1]).getByText("Portada")).toBeInTheDocument();
    expect(cards[1]).toHaveClass("border-[var(--ds-accent)]");
    expect(panel).toHaveClass("bg-[var(--ds-surface)]", "text-[var(--ds-text)]");
    expect(within(panel).getByRole("button", { name: "Subir imagen" })).toBeDisabled();
    expect(within(panel).getAllByRole("button", { name: /Editar descripción/ })).toHaveLength(4);
    expect(within(panel).getAllByRole("button", { name: /eliminar/i })).toHaveLength(4);
    expect(within(panel).getByRole("button", { name: "Eliminar Vista 2" })).toBeEnabled();
  });

  it("shows loading, an empty inactive gallery and a missing-cover warning", async () => {
    let resolveDetail!: (value: ReturnType<typeof detail>) => void;
    vi.mocked(getAdministrativeProductGallery).mockImplementationOnce(() => new Promise((resolve) => { resolveDetail = resolve; }));
    const { client } = show();
    expect(screen.getByText("Cargando galería…")).toBeInTheDocument();
    await act(async () => resolveDetail(detail([])));
    expect(await screen.findByText("Este producto todavía no tiene imágenes.")).toBeInTheDocument();
    expect(screen.getByLabelText("0 de 4 imágenes")).toBeInTheDocument();
    await act(async () => client.setQueryData(["backoffice", "product-gallery", "admin-1", productId], detail([image(0, false)])));
    expect(await screen.findByText("Este producto no tiene una portada seleccionada.")).toBeInTheDocument();
  });

  it("preserves all oversized legacy images and explains the limit", async () => {
    vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail(Array.from({ length: 6 }, (_, index) => image(index))));
    show();
    expect(await screen.findByLabelText("6 de 4 imágenes")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    expect(screen.getByRole("status")).toHaveTextContent(/Se conservan todas/);
  });

  it("recovers from an error through an explicit retry without leaking server text", async () => {
    vi.mocked(getAdministrativeProductGallery).mockRejectedValueOnce(new Error("private database error"));
    show();
    expect(await screen.findByText("No se pudo cargar la galería")).toBeInTheDocument();
    expect(screen.queryByText("private database error")).not.toBeInTheDocument();
    expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar galería" }));
    expect(await screen.findByLabelText("1 de 4 imágenes")).toBeInTheDocument();
    expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403])("does not offer unauthorized retries after %s", async (status) => {
    vi.mocked(getAdministrativeProductGallery).mockRejectedValueOnce(new ProductImageApiError(status));
    show();
    await screen.findByText("No se pudo cargar la galería");
    expect(screen.queryByRole("button", { name: "Reintentar galería" })).not.toBeInTheDocument();
  });

  it.each(["BILLING", "CUSTOMER"] as const)("does not query or display controls for %s", (role) => {
    session(role); show();
    expect(screen.queryByRole("region", { name: "Galería de imágenes" })).not.toBeInTheDocument();
    expect(getAdministrativeProductGallery).not.toHaveBeenCalled();
  });

  it("does not reveal an earlier identity's gallery after an account change or logout", async () => {
    show();
    expect(await screen.findByText("Vista 1", { selector: "p" })).toBeInTheDocument();
    vi.mocked(getAdministrativeProductGallery).mockImplementationOnce(() => new Promise(() => undefined));
    await act(async () => session("ADMIN", "admin-2"));
    expect(screen.queryByText("Vista 1", { selector: "p" })).not.toBeInTheDocument();
    await waitFor(() => expect(getAdministrativeProductGallery).toHaveBeenLastCalledWith("admin-2-token", productId, expect.any(AbortSignal)));
    await act(async () => useSessionStore.getState().clear());
    expect(screen.queryByRole("region", { name: "Galería de imágenes" })).not.toBeInTheDocument();
  });

  it("uses safe fallbacks for invalid, missing and failed thumbnails", async () => {
    vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail([
      { ...image(0), url: "javascript:alert(1)" },
      { ...image(1), url: "/images/product-placeholder.svg" }, image(2),
    ]));
    show();
    expect(await screen.findByRole("img", { name: "Vista 1" })).not.toHaveAttribute("src");
    expect(screen.getByRole("img", { name: "Vista 2" })).not.toHaveAttribute("src");
    fireEvent.error(screen.getByRole("img", { name: "Vista 3" }));
    expect(screen.getByRole("img", { name: "Vista 3" })).not.toHaveAttribute("src");
  });
});
