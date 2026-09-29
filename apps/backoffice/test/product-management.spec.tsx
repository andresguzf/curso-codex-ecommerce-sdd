import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getActiveCategories, getActiveTags } from "@technology-ecommerce/api-client";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductManagement } from "../src/features/products/product-management";
import { ProductApiError } from "../src/features/products/product-api";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams("page=1"),
}));
const api = vi.hoisted(() => ({
  createProduct: vi.fn(),
  deleteProduct: vi.fn(),
  listAdministrativeProducts: vi.fn(),
  updateProduct: vi.fn(),
  updateProductStatus: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => navigation,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("@technology-ecommerce/api-client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@technology-ecommerce/api-client")>(),
  getActiveCategories: vi.fn(),
  getActiveTags: vi.fn(),
}));
vi.mock("../src/features/products/product-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/products/product-api")>(),
  ...api,
}));

const activeProduct = {
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "USD",
  description: "Teclado mecánico RGB",
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  image: { storageKey: "products/keyboard", url: "https://picsum.photos/id/96/800/600" },
  name: "Teclado Nova 75",
  price: "89990.00",
  sku: "KEY-NOVA-75",
  status: "ACTIVE" as const,
  stockAvailable: 8,
  updatedAt: "2026-09-04T12:00:00.000Z",
};
const inactiveProduct = {
  ...activeProduct,
  id: "2ae8ff18-d0b1-46a1-907e-300923689893",
  name: "Mouse Vector",
  sku: "MOU-VECTOR",
  status: "INACTIVE" as const,
};

function renderManagement() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}><ProductManagement /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { invalidate };
}

describe("product administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveCategories).mockResolvedValue([]);
    vi.mocked(getActiveTags).mockResolvedValue([]);
    useFlashStore.getState().dismissFlash();
    api.listAdministrativeProducts.mockResolvedValue({
      items: [activeProduct, inactiveProduct],
      page: 1,
      pageSize: 10,
      totalItems: 2,
      totalPages: 1,
    });
    api.createProduct.mockResolvedValue(activeProduct);
    api.updateProduct.mockResolvedValue(activeProduct);
    api.updateProductStatus.mockResolvedValue(activeProduct);
    api.deleteProduct.mockResolvedValue(undefined);
    useSessionStore.setState({
      notice: null,
      session: {
        accessToken: "admin-token",
        accessTokenExpiresAt: "2026-09-04T13:00:00.000Z",
        sessionExpiresAt: "2026-09-11T12:00:00.000Z",
        tokenType: "Bearer",
        user: { displayName: "Admin", email: "admin@example.com", id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", role: "ADMIN" },
      },
      status: "authenticated",
    });
  });

  it("creates and edits products, then invalidates the administrative cache", async () => {
    const { invalidate } = renderManagement();
    expect(await screen.findByText("Teclado Nova 75")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo producto" }));
    expect(screen.queryByLabelText("Moneda")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "MON-ULTRA-27" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Monitor Ultra 27" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Monitor para productividad" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "299.90" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith("admin-token", expect.objectContaining({ sku: "MON-ULTRA-27", status: "INACTIVE" })));
    expect(api.createProduct).toHaveBeenCalledWith(
      "admin-token",
      expect.objectContaining({
        image: {
          storageKey: "defaults/products/mon-ultra-27/placeholder.svg",
          url: "/images/product-placeholder.svg",
        },
      }),
    );
    expect(await screen.findByText("Producto creado correctamente.")).toBeInTheDocument();

    const activeRow = screen.getByText("Teclado Nova 75").closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Nova 75 Pro" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(api.updateProduct).toHaveBeenCalledWith("admin-token", activeProduct.id, expect.objectContaining({ name: "Teclado Nova 75 Pro" })));
    expect(await screen.findByText("Producto actualizado correctamente.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
  });

  it("sends selected category and tags when creating a product", async () => {
    const categoryId = "8f732799-c098-45c1-961e-332c6becd13a";
    const tagId = "62ac275e-bbf6-43ab-8885-e5588bd24c87";
    vi.mocked(getActiveCategories).mockResolvedValue([{ id: categoryId, name: "Teclados", slug: "teclados", status: "ACTIVE", description: "", createdAt: "2026-09-04T12:00:00.000Z", updatedAt: "2026-09-04T12:00:00.000Z", deletedAt: null }]);
    vi.mocked(getActiveTags).mockResolvedValue([{ id: tagId, name: "RGB", slug: "rgb", status: "ACTIVE", createdAt: "2026-09-04T12:00:00.000Z", updatedAt: "2026-09-04T12:00:00.000Z", deletedAt: null }]);
    renderManagement();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo producto" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Teclados" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "KEY-RGB" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado RGB" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Teclado mecánico" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "89.90" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Categoría principal" }), { target: { value: categoryId } });
    fireEvent.click(screen.getByRole("button", { name: "+ RGB" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith("admin-token", expect.objectContaining({ categoryId, tagIds: [tagId] })));
  });

  it("creates removable tag chips and sends an optional product slug", async () => {
    renderManagement();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo producto" }));
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "KEY-CHIPS" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Chips" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Teclado compacto" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "89.90" } });
    fireEvent.change(screen.getByLabelText("Slug del producto"), { target: { value: "teclado-chips" } });
    const tagInput = screen.getByLabelText("Agregar etiquetas por nombre");
    fireEvent.change(tagInput, { target: { value: "RGB, mecánico," } });
    expect(screen.getByRole("button", { name: "Quitar etiqueta RGB" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar etiqueta mecánico" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quitar etiqueta RGB" }));
    fireEvent.change(tagInput, { target: { value: "inalámbrico" } });
    fireEvent.keyDown(tagInput, { key: "Enter" });
    expect(screen.queryByRole("button", { name: "Quitar etiqueta RGB" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar etiqueta inalámbrico" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith("admin-token", expect.objectContaining({ slug: "teclado-chips", tagNames: ["mecánico", "inalámbrico"] })));
    expect(screen.queryByRole("button", { name: "Crear categoría" })).not.toBeInTheDocument();
  });

  it("keeps the current slug on edits unless explicitly changed", async () => {
    api.listAdministrativeProducts.mockResolvedValue({ items: [{ ...activeProduct, slug: "teclado-nova-75", category: null, tags: [] }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    renderManagement();
    const row = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(row!).getByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Slug del producto")).toHaveValue("teclado-nova-75");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Nova Pro" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.updateProduct).toHaveBeenCalledWith("admin-token", activeProduct.id, expect.not.objectContaining({ slug: expect.anything() })));
  });

  it("sends an explicit slug change and inline tags when editing", async () => {
    api.listAdministrativeProducts.mockResolvedValue({ items: [{ ...activeProduct, slug: "teclado-nova-75", category: null, tags: [] }], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    renderManagement();
    const row = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(row!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Slug del producto"), { target: { value: "teclado-nova-pro" } });
    fireEvent.change(screen.getByLabelText("Agregar etiquetas por nombre"), { target: { value: "Óptico" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(api.updateProduct).toHaveBeenCalledWith("admin-token", activeProduct.id, expect.objectContaining({ slug: "teclado-nova-pro", tagIds: [], tagNames: ["Óptico"] })));
  });

  it("submits an unconfirmed tag name and validates the combined tag limit", async () => {
    renderManagement();
    fireEvent.click(await screen.findByRole("button", { name: "+ Nuevo producto" }));
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "KEY-DRAFT" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Draft" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Teclado compacto" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "89.90" } });
    const tagInput = screen.getByLabelText("Agregar etiquetas por nombre");
    fireEvent.change(tagInput, { target: { value: "sin confirmar" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith("admin-token", expect.objectContaining({ tagNames: ["sin confirmar"] })));

    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo producto" }));
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "KEY-LIMIT" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Limit" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Teclado compacto" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "89.90" } });
    fireEvent.change(screen.getByLabelText("Agregar etiquetas por nombre"), { target: { value: Array.from({ length: 21 }, (_, index) => `Etiqueta ${index}`).join(",") } });
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Selecciona como máximo 20 etiquetas distintas.");
    expect(api.createProduct).toHaveBeenCalledTimes(1);
  });

  it("activates, confirms deactivation and soft-deletes while invalidating cache", async () => {
    const { invalidate } = renderManagement();
    expect(await screen.findByText("Mouse Vector")).toBeInTheDocument();

    const inactiveRow = screen.getByText("Mouse Vector").closest("tr");
    fireEvent.click(within(inactiveRow!).getByRole("button", { name: "Activar" }));
    await waitFor(() => expect(api.updateProductStatus).toHaveBeenCalledWith("admin-token", inactiveProduct.id, { status: "ACTIVE" }));
    expect(await screen.findByText("Producto activado correctamente.")).toBeInTheDocument();

    const activeRow = screen.getByText("Teclado Nova 75").closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Desactivar" }));
    const deactivateDialog = screen.getByRole("dialog", { name: "¿Desactivar este producto?" });
    fireEvent.click(within(deactivateDialog).getByRole("button", { name: "Desactivar producto" }));
    await waitFor(() => expect(api.updateProductStatus).toHaveBeenCalledWith("admin-token", activeProduct.id, { status: "INACTIVE" }));

    fireEvent.click(within(activeRow!).getByRole("button", { name: "Eliminar" }));
    const deleteDialog = screen.getByRole("dialog", { name: "¿Eliminar este producto?" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Eliminar producto" }));
    await waitFor(() => expect(api.deleteProduct).toHaveBeenCalledWith("admin-token", activeProduct.id));
    expect(await screen.findByText("Producto eliminado lógicamente.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it("does not call the API when a destructive action is cancelled", async () => {
    renderManagement();
    const activeRow = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Eliminar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.deleteProduct).not.toHaveBeenCalled();
  });

  it("shows a safe flash error and keeps the form when creation fails", async () => {
    api.createProduct.mockRejectedValueOnce(new ProductApiError(409));
    renderManagement();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuevo producto" }));
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "DUPLICATE-01" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Producto repetido" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Descripción de prueba" } });
    fireEvent.change(screen.getByLabelText("Precio (USD)"), { target: { value: "299.90" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Crear producto" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));

    expect(await screen.findByText("Ya existe un producto con ese SKU o referencia de imagen.")).toBeInTheDocument();
    expect(useFlashStore.getState().flash?.tone).toBe("error");
    expect(screen.getByRole("heading", { name: "Crear producto" })).toBeInTheDocument();
  });

  it("keeps an edit open and hides internal errors when saving fails", async () => {
    api.updateProduct.mockRejectedValueOnce(new Error("private server detail"));
    renderManagement();
    const activeRow = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Nova 75 Pro" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("No pudimos guardar el producto. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar Teclado Nova 75" })).toBeInTheDocument();
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();
  });

  it("cancels deactivation and reports a rejected status change", async () => {
    api.updateProductStatus.mockRejectedValueOnce(new Error("private server detail"));
    renderManagement();
    const activeRow = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Desactivar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.updateProductStatus).not.toHaveBeenCalled();

    fireEvent.click(within(activeRow!).getByRole("button", { name: "Desactivar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar producto" }));
    expect(await screen.findByText("No pudimos cambiar el estado del producto. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useFlashStore.getState().flash?.tone).toBe("error");
  });

  it("does not delete on cancellation and reports a failed deletion without a duplicate notice", async () => {
    api.deleteProduct.mockRejectedValueOnce(new ProductApiError(403));
    renderManagement();
    const activeRow = (await screen.findByText("Teclado Nova 75")).closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Eliminar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.deleteProduct).not.toHaveBeenCalled();

    fireEvent.click(within(activeRow!).getByRole("button", { name: "Eliminar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar producto" }));
    expect(await screen.findByText("No tienes permisos para administrar productos.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useFlashStore.getState().flash?.tone).toBe("error");
    expect(screen.getAllByText("No tienes permisos para administrar productos.")).toHaveLength(1);
  });
});
