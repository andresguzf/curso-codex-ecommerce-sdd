import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { InventoryManagement } from "../src/features/inventory/inventory-management";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), searchParams: new URLSearchParams("page=1") }));
const api = vi.hoisted(() => ({
  adjustInventory: vi.fn(),
  getAdministrativeProduct: vi.fn(),
  listInventoryMovements: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/product-1/inventory",
  useRouter: () => navigation,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("../src/features/inventory/inventory-api", () => api);
vi.mock("../src/features/products/product-api", () => ({ getAdministrativeProduct: api.getAdministrativeProduct }));

const product = {
  availability: "IN_STOCK" as const,
  createdAt: "2026-09-07T12:00:00.000Z",
  currency: "CLP",
  description: "Teclado mecánico RGB",
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  image: { storageKey: "products/keyboard", url: "https://picsum.photos/id/96/800/600" },
  name: "Teclado Nova 75",
  price: "89990.00",
  sku: "KEY-NOVA-75",
  status: "ACTIVE" as const,
  stockAvailable: 5,
  updatedAt: "2026-09-07T12:00:00.000Z",
};
const movement = {
  actor: { displayName: "Admin", email: "admin@example.com", id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4" },
  balanceAfter: 5,
  createdAt: "2026-09-07T12:00:00.000Z",
  id: "0d80a4d0-5f31-44f6-87fb-d0e5f40b7a15",
  productId: product.id,
  quantityDelta: 5,
  reason: "Recepción de bodega",
  referenceId: null,
  referenceType: null,
  type: "ADJUSTMENT" as const,
};

function renderInventory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}><InventoryManagement productId={product.id} /></QueryClientProvider>);
  return { invalidate };
}

describe("inventory administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.replace.mockReset();
    api.getAdministrativeProduct.mockResolvedValue(product);
    api.listInventoryMovements.mockResolvedValue({ items: [movement], page: 1, pageSize: 10, totalItems: 1, totalPages: 1 });
    api.adjustInventory.mockResolvedValue({
      availableQuantity: 8,
      movement: { ...movement, balanceAfter: 8, quantityDelta: 3, reason: "Recepción de bodega" },
      productId: product.id,
      updatedAt: "2026-09-07T12:01:00.000Z",
      version: 1,
    });
    useSessionStore.setState({
      notice: null,
      session: {
        accessToken: "admin-token",
        accessTokenExpiresAt: "2026-09-07T13:00:00.000Z",
        sessionExpiresAt: "2026-09-14T12:00:00.000Z",
        tokenType: "Bearer",
        user: { displayName: "Admin", email: "admin@example.com", id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", role: "ADMIN" },
      },
      status: "authenticated",
    });
  });

  it("shows current availability, movement history and author", async () => {
    renderInventory();
    expect(await screen.findByText("Teclado Nova 75")).toBeInTheDocument();
    expect(screen.getByText("5", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Recepción de bodega")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
  });

  it("submits a signed adjustment, updates availability and invalidates related caches", async () => {
    const { invalidate } = renderInventory();
    await screen.findByText("Teclado Nova 75");

    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Recepción de bodega" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));

    await waitFor(() => expect(api.adjustInventory).toHaveBeenCalledWith("admin-token", product.id, { quantityDelta: 3, reason: "Recepción de bodega" }));
    expect(await screen.findByText("Inventario actualizado: 8 unidades disponibles. Movimiento registrado.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "product", product.id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "inventory-movements", product.id] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "products"] });
  });

  it("maps remove operations to a negative delta and shows the stock warning", async () => {
    renderInventory();
    await screen.findByText("Teclado Nova 75");
    fireEvent.change(screen.getByLabelText("Operación"), { target: { value: "REMOVE" } });
    expect(screen.getByText("El API rechazará el ajuste si supera las existencias disponibles.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Unidades dañadas" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));
    await waitFor(() => expect(api.adjustInventory).toHaveBeenCalledWith("admin-token", product.id, { quantityDelta: -2, reason: "Unidades dañadas" }));
  });

  it("does not submit an empty reason", async () => {
    renderInventory();
    await screen.findByText("Teclado Nova 75");
    fireEvent.click(screen.getByRole("button", { name: "Registrar ajuste" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Too small|carácter|requerido/i);
    expect(api.adjustInventory).not.toHaveBeenCalled();
  });
});
