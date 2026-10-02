import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogImage, ProductDetail } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductGalleryPanel } from "../src/features/products/product-gallery-panel";
import { deleteProductImage, getAdministrativeProductGallery, ProductImageApiError } from "../src/features/products/product-image-api";

vi.mock("../src/features/products/product-image-api", async (original) => ({
  ...await original<typeof import("../src/features/products/product-image-api")>(),
  getAdministrativeProductGallery: vi.fn(), deleteProductImage: vi.fn(),
}));
const productId = "4dff7cda-b8e6-459d-b187-dc6fb8f2582c";
const timestamp = "2026-10-01T12:00:00.000Z";
let images: CatalogImage[];
let status: "ACTIVE" | "INACTIVE";
const detail = (): ProductDetail => ({ id: productId, name: "Teclado", sku: "KEY", slug: "teclado", description: "Teclado", category: null, tags: [],
  price: "89.00", currency: "USD", status, stockAvailable: 1, availability: "IN_STOCK", createdAt: timestamp, updatedAt: timestamp,
  image: { storageKey: "original", url: "/images/product-placeholder.svg" }, coverImage: images.find((image) => image.isPrimary) ?? null, images: [...images] });
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const pending = vi.fn();
  render(<QueryClientProvider client={client}><ProductGalleryPanel onPendingChange={pending} productId={productId} /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { invalidate, pending };
}
async function open(name = "Vista 2") {
  const trigger = await screen.findByRole("button", { name: `Eliminar ${name}` });
  trigger.focus(); fireEvent.click(trigger);
  await screen.findByRole("dialog", { name: "Eliminar imagen del producto" });
  return trigger;
}
async function confirm(name = "Vista 2") { await open(name); fireEvent.click(screen.getByRole("button", { name: "Eliminar imagen" })); }

describe("confirmed gallery removal", () => {
  beforeEach(() => {
    vi.clearAllMocks(); useFlashStore.getState().dismissFlash();
    useSessionStore.setState({ status: "authenticated", session: {
      accessToken: "admin-token", tokenType: "Bearer", accessTokenExpiresAt: timestamp, sessionExpiresAt: timestamp,
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", displayName: "Admin" },
    } });
    status = "ACTIVE";
    images = Array.from({ length: 3 }, (_, index) => ({ id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, storageKey: `image-${index}`, url: "/images/product-placeholder.svg", altText: `Vista ${index + 1}`, isPrimary: index === 0, sortOrder: index, width: null, height: null, mimeType: "image/png" }));
    vi.mocked(getAdministrativeProductGallery).mockImplementation(async () => detail());
    vi.mocked(deleteProductImage).mockImplementation(async (_token, _product, id) => {
      images = images.filter((image) => image.id !== id).map((image, index) => ({ ...image, sortOrder: index }));
    });
  });

  it.each(["Cancelar", "Escape"])("cancels using %s without REST and restores focus", async (action) => {
    show(); const trigger = await open();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    if (action === "Escape") fireEvent.keyDown(document, { key: "Escape" });
    else fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(screen.getByLabelText("3 de 4 imágenes")).toBeInTheDocument();
  });

  it("removes one additional image, refreshes detail/list cache and focuses the next handle", async () => {
    const id = images[1]!.id; const { invalidate, pending } = show(); await confirm();
    expect(await screen.findByLabelText("2 de 4 imágenes")).toBeInTheDocument();
    expect(await screen.findByText("Imagen eliminada correctamente.")).toBeInTheDocument();
    expect(deleteProductImage).toHaveBeenCalledWith("admin-token", productId, id, expect.any(AbortSignal));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "product-gallery", "admin-1", productId], exact: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Arrastrar Vista 3 para ordenar" })).toHaveFocus());
    expect(pending.mock.calls.map(([value]) => value)).toEqual([true, false]);
    expect(images.map((image) => image.sortOrder)).toEqual([0, 1]);
  });

  it("protects the sole active cover and explains how to remove a cover", async () => {
    images = images.slice(0, 1); show();
    const button = await screen.findByRole("button", { name: "Eliminar Vista 1" });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(screen.getByText(/El producto activo debe conservar una portada/)).toBeInTheDocument();
    expect(deleteProductImage).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows an inactive product to lose its final cover and keeps focus usable", async () => {
    status = "INACTIVE"; images = images.slice(0, 1); show(); await confirm("Vista 1");
    expect(await screen.findByLabelText("0 de 4 imágenes")).toBeInTheDocument();
    expect(screen.getByText("Este producto todavía no tiene imágenes.")).toBeInTheDocument();
    expect(screen.getByLabelText("Archivo de imagen")).toBeEnabled();
    await waitFor(() => expect(screen.getByRole("region", { name: "Galería de imágenes" })).toHaveFocus());
  });

  it("regularizes oversized collections without truncation and unlocks uploads only below four", async () => {
    images = Array.from({ length: 5 }, (_, index) => ({ ...images[0]!, id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, altText: `Vista ${index + 1}`, sortOrder: index, isPrimary: index === 0 }));
    show(); await confirm("Vista 5");
    expect(await screen.findByLabelText("4 de 4 imágenes")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByLabelText("Archivo de imagen")).toBeDisabled();
    await confirm("Vista 4");
    expect(await screen.findByLabelText("3 de 4 imágenes")).toBeInTheDocument();
    expect(screen.getByLabelText("Archivo de imagen")).toBeEnabled();
    expect(deleteProductImage).toHaveBeenCalledTimes(2);
  });

  it("blocks duplicate confirmation and all other mutations until authoritative recovery", async () => {
    let resolve!: () => void;
    vi.mocked(deleteProductImage).mockImplementationOnce(() => new Promise<void>((done) => { resolve = done; }));
    const { pending } = show(); await open();
    const button = screen.getByRole("button", { name: "Eliminar imagen" }); fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(deleteProductImage).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(screen.getByLabelText("Archivo de imagen")).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" }); expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(pending).not.toHaveBeenCalledWith(false);
    await act(async () => resolve());
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it.each([401, 403, 404, 409])("recovers safely after server rejection %i without optimistic deletion or automatic replay", async (code) => {
    vi.mocked(deleteProductImage).mockRejectedValueOnce(new ProductImageApiError(code, code === 409 ? "PRODUCT_PRIMARY_IMAGE_REQUIRED" : undefined));
    show(); await confirm();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByLabelText("3 de 4 imágenes")).toBeInTheDocument();
    expect(deleteProductImage).toHaveBeenCalledTimes(1);
    expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2);
    expect(useFlashStore.getState().flash?.tone).toBe("error");
    if (code === 409) expect(screen.getByText("Selecciona otra portada antes de quitar la portada actual.")).toBeInTheDocument();
  });

  it("recovers a committed DELETE whose response was lost without retrying it", async () => {
    vi.mocked(deleteProductImage).mockImplementationOnce(async () => { images = images.filter((image) => image.altText !== "Vista 2"); throw new Error("network"); });
    show(); await confirm();
    expect(await screen.findByLabelText("2 de 4 imágenes")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText(/No se pudo eliminar la imagen/)).toBeInTheDocument();
    expect(deleteProductImage).toHaveBeenCalledTimes(1);
  });

  it("closes the private modal on logout without sending removal", async () => {
    show(); await open();
    act(() => useSessionStore.setState({ status: "anonymous", session: null }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.queryByText("Vista 2")).not.toBeInTheDocument();
    expect(deleteProductImage).not.toHaveBeenCalled();
  });

  it("aborts pending removal on account change and never announces success for the next identity", async () => {
    let resolve!: () => void;
    let signal: AbortSignal | undefined;
    vi.mocked(deleteProductImage).mockImplementationOnce((_token, _product, _image, incoming) => {
      signal = incoming;
      return new Promise<void>((done) => { resolve = done; });
    });
    show(); await confirm();
    await waitFor(() => expect(deleteProductImage).toHaveBeenCalledTimes(1));
    act(() => useSessionStore.setState({ status: "anonymous", session: null }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => resolve());
    expect(screen.queryByText("Imagen eliminada correctamente.")).not.toBeInTheDocument();
    expect(deleteProductImage).toHaveBeenCalledTimes(1);
  });
});
