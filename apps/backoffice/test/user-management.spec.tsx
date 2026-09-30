import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdministrativeUser, AuthRole } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { UserManagement } from "../src/features/users/user-management";
import { UserApiError } from "../src/features/users/user-api";

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
}));
const api = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listUsers: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/users",
  useRouter: () => navigation,
  useSearchParams: () => navigation.searchParams,
}));
vi.mock("../src/features/users/user-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/users/user-api")>(),
  ...api,
}));

const admin: AdministrativeUser = {
  id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  displayName: "Ana Admin",
  email: "ana@example.com",
  role: "ADMIN",
  status: "ACTIVE",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  deletedAt: null,
};
const customer: AdministrativeUser = {
  ...admin,
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  displayName: "Luis Cliente",
  email: "luis@example.com",
  role: "CUSTOMER",
  status: "INACTIVE",
};

function setSession(role: AuthRole | null) {
  if (!role) {
    useSessionStore.setState({ notice: null, session: null, status: "anonymous" });
    return;
  }
  useSessionStore.setState({
    notice: null,
    status: "authenticated",
    session: {
      accessToken: `${role}-token`,
      accessTokenExpiresAt: "2026-09-23T12:00:00.000Z",
      sessionExpiresAt: "2026-09-30T12:00:00.000Z",
      tokenType: "Bearer",
      user: { id: admin.id, displayName: "Ana Admin", email: admin.email, role },
    },
  });
}

function renderManagement() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}><UserManagement /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { invalidate };
}

describe("user administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.searchParams = new URLSearchParams();
    useFlashStore.getState().dismissFlash();
    setSession("ADMIN");
    api.listUsers.mockResolvedValue({ items: [admin, customer], page: 1, pageSize: 20, totalItems: 2, totalPages: 1 });
    api.createUser.mockResolvedValue(customer);
    api.updateUser.mockResolvedValue(customer);
    api.deleteUser.mockResolvedValue(undefined);
  });

  it("loads one backend page and keeps search, filters and pagination in the URL", async () => {
    navigation.searchParams = new URLSearchParams("page=2&search=ana&role=ADMIN&status=ACTIVE&pageSize=10");
    api.listUsers.mockResolvedValue({ items: [admin], page: 2, pageSize: 10, totalItems: 24, totalPages: 3 });
    renderManagement();

    expect(await screen.findByText("Ana Admin")).toBeInTheDocument();
    expect(api.listUsers).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({ page: 2, pageSize: 10, search: "ana", role: "ADMIN", status: "ACTIVE" }), expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=3"), { scroll: false });

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar usuarios" }), { target: { value: "nuevo" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=1"), { scroll: false });
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("search=nuevo"), { scroll: false });

    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), { target: { value: "BILLING" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("role=BILLING"), { scroll: false });
  });

  it("uses the same paginated workspace for the dedicated customer list", async () => {
    navigation.searchParams = new URLSearchParams("role=CUSTOMER&page=1");
    api.listUsers.mockResolvedValue({ items: [customer], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 });
    renderManagement();

    expect(await screen.findByText("Luis Cliente")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByRole("search", { name: "Buscar clientes" })).toBeInTheDocument();
    expect(api.listUsers).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({ role: "CUSTOMER", page: 1 }), expect.any(AbortSignal));
  });

  it("creates a user with a role and shows a safe error when a duplicate email is rejected", async () => {
    const { invalidate } = renderManagement();
    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Bea Billing" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Correo electrónico" }), { target: { value: "bea@example.com" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), { target: { value: "BILLING" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "clave-larga-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));

    await waitFor(() => expect(api.createUser).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({ email: "bea@example.com", role: "BILLING", status: "ACTIVE" })));
    expect(await screen.findByText("Usuario creado.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "users"] });

    api.createUser.mockRejectedValueOnce(new UserApiError(409, "USER_EMAIL_ALREADY_REGISTERED"));
    fireEvent.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Bea Billing" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Correo electrónico" }), { target: { value: "bea@example.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña inicial"), { target: { value: "clave-larga-2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
    expect(await screen.findByText("Ya existe una cuenta con ese correo.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crear usuario" })).toBeInTheDocument();
  });

  it("edits a role without sending an empty password and activates an inactive account", async () => {
    renderManagement();
    const row = (await screen.findByText("Luis Cliente")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Editar Luis Cliente" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Rol" }), { target: { value: "BILLING" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("ADMIN-token", customer.id, expect.objectContaining({ role: "BILLING" })));
    expect(api.updateUser.mock.calls[0]![2]).not.toHaveProperty("password");
    expect(await screen.findByText("Usuario actualizado.")).toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Activar Luis Cliente" }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("ADMIN-token", customer.id, { status: "ACTIVE" }));
  });

  it("keeps an edit open after failure and confirms blocking an active account", async () => {
    api.updateUser.mockRejectedValueOnce(new Error("private server detail"));
    renderManagement();
    const row = (await screen.findByText("Ana Admin")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Editar Ana Admin" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Ana Updated" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
    expect(await screen.findByText("No pudimos completar la operación. Inténtalo nuevamente.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Editar Ana Admin" })).toBeInTheDocument();
    expect(screen.queryByText("private server detail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(within(row).getByRole("button", { name: "Bloquear Ana Admin" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Bloquear usuario" }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("ADMIN-token", admin.id, { status: "BLOCKED" }));
    expect(await screen.findByText("Usuario bloqueado.")).toBeInTheDocument();
  });

  it("requires confirmation for deactivation and deletion, and reports last-admin conflicts", async () => {
    const user = userEvent.setup();
    renderManagement();
    const row = (await screen.findByText("Ana Admin")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Desactivar Ana Admin" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.updateUser).not.toHaveBeenCalled();

    api.updateUser.mockRejectedValueOnce(new UserApiError(409, "USER_LAST_ACTIVE_ADMIN"));
    await user.click(within(row).getByRole("button", { name: "Desactivar Ana Admin" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar usuario" }));
    expect(await screen.findByText("No se puede desactivar o eliminar al último administrador activo.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Eliminar Ana Admin" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.deleteUser).not.toHaveBeenCalled();
    await user.click(within(row).getByRole("button", { name: "Eliminar Ana Admin" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar usuario" }));
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith("ADMIN-token", admin.id));
    expect(await screen.findByText("Usuario eliminado lógicamente.")).toBeInTheDocument();
  });

  it("reports deletion failures safely after dismissing the dialog", async () => {
    api.deleteUser.mockRejectedValueOnce(new UserApiError(409, "USER_LAST_ACTIVE_ADMIN"));
    renderManagement();
    const row = (await screen.findByText("Ana Admin")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Eliminar Ana Admin" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar usuario" }));
    expect(await screen.findByText("No se puede desactivar o eliminar al último administrador activo.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useFlashStore.getState().flash?.tone).toBe("error");
  });

  it.each(["BILLING", "CUSTOMER"] as const)("denies the user workspace to %s without querying accounts", (role) => {
    setSession(role);
    renderManagement();
    expect(screen.getByText("Tu rol no puede administrar usuarios.")).toBeInTheDocument();
    expect(api.listUsers).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors without querying accounts", async () => {
    setSession(null);
    renderManagement();
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(api.listUsers).not.toHaveBeenCalled();
  });
});
