import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogImage, ProductDetail } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductGalleryPanel } from "../src/features/products/product-gallery-panel";
import { getAdministrativeProductGallery, updateProductImage, uploadProductImage, ProductImageApiError } from "../src/features/products/product-image-api";

vi.mock("../src/features/products/product-image-api", async (original) => ({
  ...await original<typeof import("../src/features/products/product-image-api")>(),
  getAdministrativeProductGallery: vi.fn(), updateProductImage: vi.fn(), uploadProductImage: vi.fn(),
}));
const productId = "4dff7cda-b8e6-459d-b187-dc6fb8f2582c";
const timestamp = "2026-10-01T12:00:00.000Z";
let images: CatalogImage[];
const detail = (): ProductDetail => ({ id: productId, name: "Teclado", sku: "KEY", slug: "teclado", description: "Teclado", category: null, tags: [],
  price: "89.00", currency: "USD", status: "ACTIVE", stockAvailable: 1, availability: "IN_STOCK", createdAt: timestamp, updatedAt: timestamp,
  image: { storageKey: "original", url: "/images/product-placeholder.svg" }, coverImage: images.find((image) => image.isPrimary)!, images: [...images] });
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const pending = vi.fn();
  render(<QueryClientProvider client={client}><ProductGalleryPanel onPendingChange={pending} productId={productId} /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { invalidate, pending };
}
function names() { return screen.getAllByRole("listitem").map((item) => within(item).getByRole("img").getAttribute("aria-label")); }

describe("administrative gallery editing", () => {
  beforeEach(() => {
    vi.clearAllMocks(); useFlashStore.getState().dismissFlash();
    useSessionStore.setState({ status: "authenticated", session: {
      accessToken: "admin-token", tokenType: "Bearer", accessTokenExpiresAt: timestamp, sessionExpiresAt: timestamp,
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", displayName: "Admin" },
    } });
    images = [0, 1, 2].map((index) => ({ id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, storageKey: `image-${index}`, url: "/images/product-placeholder.svg", altText: `Vista ${index + 1}`, isPrimary: index === 0, sortOrder: index, width: null, height: null, mimeType: "image/png" }));
    vi.mocked(getAdministrativeProductGallery).mockImplementation(async () => detail());
    vi.mocked(updateProductImage).mockImplementation(async (_token, _product, id, input) => {
      const changed = { ...images.find((image) => image.id === id)!, ...input };
      images = images.map((image) => image.id === id ? changed : input.isPrimary ? { ...image, isPrimary: false } : image);
      if (input.sortOrder !== undefined) {
        images = images.filter((image) => image.id !== id);
        images.splice(input.sortOrder, 0, changed);
      }
      images = images.map((image, index) => ({ ...image, sortOrder: index }));
      return { ...images.find((image) => image.id === id)!, productId, createdAt: timestamp, updatedAt: timestamp };
    });
  });

  it("edits alternate text with validation, Enter and authoritative invalidation", async () => {
    const { invalidate } = show();
    fireEvent.click(await screen.findByRole("button", { name: "Editar descripción de Vista 2" }));
    const field = screen.getByLabelText("Texto alternativo");
    await waitFor(() => expect(field).toHaveFocus());
    fireEvent.change(field, { target: { value: "   " } }); fireEvent.keyDown(field, { key: "Enter" });
    expect(await screen.findByText("Describe la imagen.")).toBeInTheDocument();
    expect(updateProductImage).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: " Vista lateral " } }); fireEvent.keyDown(field, { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Editar descripción de Vista lateral" })).toBeInTheDocument();
    expect(updateProductImage).toHaveBeenCalledWith("admin-token", productId, images[1]!.id, { altText: "Vista lateral" }, expect.any(AbortSignal));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
    expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2);
  });

  it("cancels metadata editing without sending a request and restores focus", async () => {
    show(); fireEvent.click(await screen.findByRole("button", { name: "Editar descripción de Vista 2" }));
    fireEvent.change(screen.getByLabelText("Texto alternativo"), { target: { value: "Borrador" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar edición de Vista 2" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar descripción de Vista 2" })).toHaveFocus());
    expect(updateProductImage).not.toHaveBeenCalled();
  });

  it("selects exactly one cover from the authoritative response", async () => {
    show(); fireEvent.click(await screen.findByRole("button", { name: "Usar Vista 2 como portada" }));
    expect(await screen.findByRole("button", { name: "Vista 2 es portada" })).toBeDisabled();
    expect(screen.getAllByText("Portada", { exact: true })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Usar Vista 1 como portada" })).toBeEnabled();
    expect(images.filter((image) => image.isPrimary)).toHaveLength(1);
  });

  it("moves with keyboard-equivalent buttons, preserves order after refetch and restores the handle focus", async () => {
    const id = images[2]!.id;
    show(); fireEvent.click(await screen.findByRole("button", { name: "Subir Vista 3" }));
    await waitFor(() => expect(names()).toEqual(["Vista 1", "Vista 3", "Vista 2"]));
    expect(updateProductImage).toHaveBeenCalledWith("admin-token", productId, id, { sortOrder: 1 }, expect.any(AbortSignal));
    await waitFor(() => expect(screen.getByRole("button", { name: "Arrastrar Vista 3 para ordenar" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Subir Vista 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Vista 2" })).toBeDisabled();
  });

  it("moves by drag using one PATCH and ignores external or identical drops", async () => {
    show(); const handle = await screen.findByRole("button", { name: "Arrastrar Vista 3 para ordenar" });
    const target = screen.getAllByRole("listitem")[0]!;
    fireEvent.drop(target, { dataTransfer: { getData: () => "external" } }); expect(updateProductImage).not.toHaveBeenCalled();
    fireEvent.dragStart(handle, { dataTransfer: { setData: vi.fn() } });
    fireEvent.drop(target);
    await waitFor(() => expect(names()).toEqual(["Vista 3", "Vista 1", "Vista 2"]));
    expect(updateProductImage).toHaveBeenCalledTimes(1);
  });

  it("serializes updates with uploads and blocks duplicate commands until recovery finishes", async () => {
    let resolve!: () => void;
    vi.mocked(updateProductImage).mockImplementationOnce(() => new Promise((done) => { resolve = () => done({ ...images[1]!, productId, createdAt: timestamp, updatedAt: timestamp }); }));
    const { pending } = show(); const cover = await screen.findByRole("button", { name: "Usar Vista 2 como portada" });
    fireEvent.click(cover); fireEvent.click(cover);
    await waitFor(() => expect(updateProductImage).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Archivo de imagen")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Vista 1" })).toBeDisabled();
    await act(async () => resolve());
    await waitFor(() => expect(screen.getByLabelText("Archivo de imagen")).toBeEnabled());
    expect(pending.mock.calls.map(([value]) => value)).toEqual([true, false]); expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("keeps usable focus when another administrator has removed the edited image", async () => {
    vi.mocked(updateProductImage).mockImplementationOnce(async () => {
      images = images.filter((image) => image.altText !== "Vista 3");
      throw new ProductImageApiError(404, "PRODUCT_IMAGE_NOT_FOUND");
    });
    show(); fireEvent.click(await screen.findByRole("button", { name: "Subir Vista 3" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "Galería de imágenes" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Subir Vista 3" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("2 de 4 imágenes")).toBeInTheDocument();
  });

  it.each([new ProductImageApiError(409, "PRODUCT_IMAGE_ORDER_INVALID"), new Error("private server data")])("recovers authoritative order on failure without retry or optimistic success", async (error) => {
    vi.mocked(updateProductImage).mockRejectedValueOnce(error);
    show(); fireEvent.click(await screen.findByRole("button", { name: "Subir Vista 3" }));
    await waitFor(() => expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2));
    expect(names()).toEqual(["Vista 1", "Vista 2", "Vista 3"]);
    expect(screen.queryByText("Galería actualizada correctamente.")).not.toBeInTheDocument();
    expect(screen.queryByText("private server data")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Arrastrar Vista 3 para ordenar" })).toHaveFocus());
    expect(updateProductImage).toHaveBeenCalledTimes(1);
  });
});
