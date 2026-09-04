import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ProductManagement } from "../src/features/products/product-management";

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
vi.mock("../src/features/products/product-api", () => api);

const activeProduct = {
  createdAt: "2026-09-04T12:00:00.000Z",
  currency: "CLP",
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
  render(<QueryClientProvider client={queryClient}><ProductManagement /></QueryClientProvider>);
  return { invalidate };
}

describe("product administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    fireEvent.change(screen.getByLabelText("SKU"), { target: { value: "MON-ULTRA-27" } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Monitor Ultra 27" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Monitor para productividad" } });
    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "299990.00" } });
    fireEvent.change(screen.getByLabelText("URL de imagen"), { target: { value: "https://picsum.photos/id/1/800/600" } });
    fireEvent.change(screen.getByLabelText("Clave de almacenamiento"), { target: { value: "products/monitor-ultra-27" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear producto" }));

    await waitFor(() => expect(api.createProduct).toHaveBeenCalledWith("admin-token", expect.objectContaining({ sku: "MON-ULTRA-27", status: "INACTIVE" })));
    expect(await screen.findByText("Producto creado correctamente.")).toBeInTheDocument();

    const activeRow = screen.getByText("Teclado Nova 75").closest("tr");
    fireEvent.click(within(activeRow!).getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Teclado Nova 75 Pro" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(api.updateProduct).toHaveBeenCalledWith("admin-token", activeProduct.id, expect.objectContaining({ name: "Teclado Nova 75 Pro" })));
    expect(await screen.findByText("Producto actualizado correctamente.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
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
});
