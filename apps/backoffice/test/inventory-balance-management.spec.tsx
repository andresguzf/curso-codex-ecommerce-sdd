import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { InventoryBalanceManagement } from "../src/features/inventory/inventory-balance-management";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), search: "" }));
const api = vi.hoisted(() => ({ listInventoryBalances: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/inventory", useRouter: () => navigation, useSearchParams: () => new URLSearchParams(navigation.search) }));
vi.mock("../src/features/inventory/inventory-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/inventory/inventory-api")>(),
  ...api,
}));

const balance = {
  availableQuantity: 7,
  name: "Teclado Nova 75",
  productId: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  sku: "KEY-NOVA-75",
  status: "ACTIVE" as const,
  updatedAt: "2026-09-07T12:00:00.000Z",
  version: 2,
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><InventoryBalanceManagement /></QueryClientProvider>);
}

describe("inventory balance administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.search = "";
    api.listInventoryBalances.mockResolvedValue({ items: [balance], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
    useSessionStore.setState({
      notice: null,
      session: {
        accessToken: "admin-token",
        accessTokenExpiresAt: "2026-09-07T13:00:00.000Z",
        sessionExpiresAt: "2026-09-14T12:00:00.000Z",
        tokenType: "Bearer",
        user: { displayName: "Admin", email: "admin@example.com", id: balance.productId, role: "ADMIN" },
      },
      status: "authenticated",
    });
  });

  it("loads one backend page, searches products and applies URL-backed availability filters", async () => {
    navigation.search = "page=2&search=teclado&availability=IN_STOCK&status=ACTIVE&pageSize=10&sortBy=name&sortOrder=asc";
    api.listInventoryBalances.mockResolvedValue({ items: [balance], page: 2, pageSize: 10, totalItems: 21, totalPages: 3 });
    mount();

    expect(await screen.findByText("Teclado Nova 75")).toBeInTheDocument();
    expect(api.listInventoryBalances).toHaveBeenCalledWith("admin-token", expect.objectContaining({ page: 2, pageSize: 10, search: "teclado", availability: "IN_STOCK", status: "ACTIVE", sortBy: "name", sortOrder: "asc" }), expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=3"), { scroll: false });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar inventario" }), { target: { value: "monitor" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("search=monitor"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Disponibilidad" }), { target: { value: "OUT_OF_STOCK" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("availability=OUT_OF_STOCK"), { scroll: false });
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=1"), { scroll: false });
  });
});
