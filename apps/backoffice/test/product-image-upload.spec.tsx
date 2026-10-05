import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CatalogImage, ProductDetail, ProductGalleryImage } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductGalleryPanel } from "../src/features/products/product-gallery-panel";
import { getAdministrativeProductGallery, uploadProductImage, ProductImageApiError } from "../src/features/products/product-image-api";

vi.mock("../src/features/products/product-image-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/products/product-image-api")>(),
  getAdministrativeProductGallery: vi.fn(), uploadProductImage: vi.fn(),
}));
const NativeURL = URL;
let previewCount = 0;
const createPreview = vi.fn(() => `blob:preview-${++previewCount}`);
const revokePreview = vi.fn();
const productId = "4dff7cda-b8e6-459d-b187-dc6fb8f2582c";
const image: CatalogImage = {
  id: "18ef6b72-3291-4bd7-a68f-0eec92d54d7c", storageKey: "uploaded.png", url: "https://example.com/uploaded.png",
  altText: "Vista del teclado", isPrimary: true, sortOrder: 0, width: 800, height: 600, mimeType: "image/png",
};
const uploaded: ProductGalleryImage = { ...image, productId, createdAt: "2026-10-01T12:00:00.000Z", updatedAt: "2026-10-01T12:00:00.000Z" };
function detail(images: CatalogImage[] = []): ProductDetail {
  return { id: productId, name: "Teclado", sku: "KEY-01", slug: "teclado", category: null, tags: [],
    description: "Teclado mecánico", price: "89.00", currency: "USD", status: "INACTIVE", stockAvailable: 0,
    availability: "OUT_OF_STOCK", image: { storageKey: "placeholder", url: "/images/product-placeholder.svg" },
    images, coverImage: images.find((entry) => entry.isPrimary) ?? null,
    createdAt: uploaded.createdAt, updatedAt: uploaded.updatedAt,
  };
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidation = vi.spyOn(client, "invalidateQueries");
  const pending = vi.fn();
  const view = render(<QueryClientProvider client={client}><ProductGalleryPanel onPendingChange={pending} productId={productId} /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { ...view, pending, invalidation };
}
async function select(type = "image/png", data = "valid test bytes") {
  const file = new File([data], "keyboard.png", { type });
  fireEvent.change(await screen.findByLabelText("Archivo de imagen"), { target: { files: [file] } });
  return file;
}

describe("product image upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previewCount = 0;
    vi.stubGlobal("URL", class extends NativeURL { static createObjectURL = createPreview; static revokeObjectURL = revokePreview; });
    useFlashStore.getState().dismissFlash();
    useSessionStore.setState({ status: "authenticated", session: {
      accessToken: "admin-token", tokenType: "Bearer", accessTokenExpiresAt: "2026-10-01T13:00:00.000Z", sessionExpiresAt: "2026-10-08T12:00:00.000Z",
      user: { id: "admin-1", role: "ADMIN", email: "admin@example.com", displayName: "Admin" },
    } });
    vi.mocked(getAdministrativeProductGallery).mockResolvedValue(detail());
    vi.mocked(uploadProductImage).mockResolvedValue(uploaded);
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("rejects oversized files before preview or REST upload", async () => {
    show();
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    fireEvent.change(await screen.findByLabelText("Archivo de imagen"), { target: { files: [file] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("La imagen supera el máximo");
    expect(createPreview).not.toHaveBeenCalled();
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("previews and uploads one %s file and refreshes the authoritative gallery", async (type) => {
    vi.mocked(getAdministrativeProductGallery).mockResolvedValueOnce(detail()).mockResolvedValue(detail([image]));
    const { pending, invalidation } = show();
    const file = await select(type);
    expect(screen.getByRole("img", { name: "Vista previa de la imagen seleccionada" })).toHaveAttribute("src", "blob:preview-1");
    expect(screen.getByLabelText("0 de 4 imágenes")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: " Vista del teclado " } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    expect(await screen.findByText("Imagen subida correctamente.")).toBeInTheDocument();
    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledWith("admin-token", productId, file, { altText: "Vista del teclado" }, expect.any(AbortSignal)));
    expect(await screen.findByLabelText("1 de 4 imágenes")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("img", { name: "Vista previa de la imagen seleccionada" })).not.toBeInTheDocument());
    expect(screen.getByLabelText("Texto alternativo de la nueva imagen")).toHaveValue("");
    expect(revokePreview).toHaveBeenCalledWith("blob:preview-1");
    expect(pending.mock.calls.map(([value]) => value)).toEqual([true, false]);
    expect(invalidation).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
    expect(uploadProductImage).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported or empty files and missing alternate text without sending an upload", async () => {
    show();
    await select("image/svg+xml");
    expect(screen.getByText(/Selecciona un archivo JPEG, PNG o WebP que no esté vacío/)).toBeInTheDocument();
    await select("image/png", "");
    expect(createPreview).not.toHaveBeenCalled();
    await select();
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    expect(await screen.findByText("Describe la imagen antes de subirla.")).toBeInTheDocument();
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("releases previews when replacing, discarding and unmounting a selection", async () => {
    const view = show();
    await select(); await select("image/jpeg");
    expect(revokePreview).toHaveBeenCalledWith("blob:preview-1");
    fireEvent.click(screen.getByRole("button", { name: "Descartar selección" }));
    expect(revokePreview).toHaveBeenCalledWith("blob:preview-2");
    await select();
    view.unmount();
    expect(revokePreview).toHaveBeenCalledWith("blob:preview-3");
  });

  it("blocks duplicate submissions and remains pending until the upload and refresh finish", async () => {
    let resolveUpload!: (value: ProductGalleryImage) => void;
    vi.mocked(uploadProductImage).mockImplementationOnce(() => new Promise((resolve) => { resolveUpload = resolve; }));
    const view = show(); await select();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: "Vista" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Subiendo imagen…" })).toBeDisabled();
    expect(screen.getByLabelText("Archivo de imagen")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Subiendo imagen…" }));
    expect(uploadProductImage).toHaveBeenCalledTimes(1);
    await act(async () => resolveUpload(uploaded));
    await waitFor(() => expect(view.pending).toHaveBeenLastCalledWith(false));
  });

  it.each([413, 400])("retains the selection after a %s rejection and retries only when requested", async (status) => {
    vi.mocked(uploadProductImage).mockRejectedValueOnce(new ProductImageApiError(status));
    show(); await select();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: "Vista" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    await waitFor(() => expect(useFlashStore.getState().flash?.tone).toBe("error"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled());
    expect(uploadProductImage).toHaveBeenCalledTimes(1);
    expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Texto alternativo de la nueva imagen")).toHaveValue("Vista");
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(2));
  });

  it("refreshes after a concurrent quota conflict and disables further uploads", async () => {
    const full = Array.from({ length: 4 }, (_, index) => ({ ...image, id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, sortOrder: index, isPrimary: index === 0 }));
    vi.mocked(getAdministrativeProductGallery).mockResolvedValueOnce(detail([image])).mockResolvedValue(detail(full));
    vi.mocked(uploadProductImage).mockRejectedValueOnce(new ProductImageApiError(409, "PRODUCT_IMAGE_LIMIT_REACHED"));
    show(); await select();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: "Vista" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    expect(await screen.findByLabelText("4 de 4 imágenes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir imagen" })).toBeDisabled();
    expect(uploadProductImage).toHaveBeenCalledTimes(1);
    expect(useFlashStore.getState().flash?.tone).toBe("error");
  });

  it("recovers an uncertain network result before allowing a manual retry", async () => {
    vi.mocked(uploadProductImage).mockRejectedValueOnce(new Error("private transport detail"));
    show(); await select();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: "Vista" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    expect(await screen.findByText("No se pudo subir la imagen. Revisa la galería antes de reintentar.")).toBeInTheDocument();
    await waitFor(() => expect(getAdministrativeProductGallery).toHaveBeenCalledTimes(2));
    expect(uploadProductImage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("private transport detail")).not.toBeInTheDocument();
  });

  it("aborts on unmount and releases the preview without a private notice", async () => {
    vi.mocked(uploadProductImage).mockImplementation((_token, _id, _file, _metadata, signal) => new Promise((_resolve, reject) => {
      signal!.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const view = show(); await select();
    fireEvent.change(screen.getByLabelText("Texto alternativo de la nueva imagen"), { target: { value: "Vista" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
    await waitFor(() => expect(uploadProductImage).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(vi.mocked(uploadProductImage).mock.calls[0][4]!.aborted).toBe(true);
    expect(revokePreview).toHaveBeenCalledWith("blob:preview-1");
    await waitFor(() => expect(view.pending).toHaveBeenLastCalledWith(false));
    expect(useFlashStore.getState().flash).toBeNull();
  });
});
