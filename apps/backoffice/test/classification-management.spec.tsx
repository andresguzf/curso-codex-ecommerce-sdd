import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthRole, Category, Tag } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { ClassificationManagement } from "../src/features/classifications/classification-management";
import { ClassificationApiError } from "../src/features/classifications/classification-api";

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), searchParams: new URLSearchParams() }));
const api = vi.hoisted(() => ({ createClassification: vi.fn(), updateClassification: vi.fn(), deleteClassification: vi.fn(), listClassifications: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/categories", useRouter: () => navigation, useSearchParams: () => navigation.searchParams }));
vi.mock("../src/features/classifications/classification-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/classifications/classification-api")>(),
  ...api,
}));

const category: Category = {
  id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4",
  name: "Portátiles",
  slug: "portatiles",
  description: "Equipos para trabajo móvil",
  status: "ACTIVE",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  deletedAt: null,
};
const tag: Tag = {
  id: "4dff7cda-b8e6-459d-b187-dc6fb8f2582c",
  name: "Gamer",
  slug: "gamer",
  status: "INACTIVE",
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-01T12:00:00.000Z",
  deletedAt: null,
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
      accessTokenExpiresAt: "2026-09-30T12:00:00.000Z",
      sessionExpiresAt: "2026-09-30T12:00:00.000Z",
      tokenType: "Bearer",
      user: { id: category.id, displayName: "Ana Admin", email: "ana@example.com", role },
    },
  });
}

function renderManagement(kind: "categories" | "tags") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(<QueryClientProvider client={queryClient}><ClassificationManagement kind={kind} /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
  return { invalidate };
}

describe("administrative categories and tags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.searchParams = new URLSearchParams();
    useFlashStore.getState().dismissFlash();
    setSession("ADMIN");
    api.listClassifications.mockImplementation(async (kind: string, _token, query) => ({ items: query.showOnLanding ? [] : kind === "categories" ? [category] : [tag], page: 1, pageSize: query.pageSize, totalItems: query.showOnLanding ? 0 : 1, totalPages: query.showOnLanding ? 0 : 1 }));
    api.createClassification.mockResolvedValue(category);
    api.updateClassification.mockResolvedValue(category);
    api.deleteClassification.mockResolvedValue(undefined);
  });

  it("requests one backend page and keeps search, filters and pagination in the URL", async () => {
    navigation.searchParams = new URLSearchParams("page=2&search=port&status=ACTIVE&pageSize=10&sortBy=name&sortOrder=asc");
    api.listClassifications.mockImplementation(async (_kind, _token, query) => query.showOnLanding ? { items: [], page: 1, pageSize: 3, totalItems: 0, totalPages: 0 } : { items: [category], page: 2, pageSize: 10, totalItems: 24, totalPages: 3 });
    renderManagement("categories");
    expect(await screen.findByText("Portátiles")).toBeInTheDocument();
    expect(api.listClassifications).toHaveBeenCalledWith("categories", "ADMIN-token", expect.objectContaining({ page: 2, pageSize: 10, search: "port", status: "ACTIVE", sortBy: "name", sortOrder: "asc" }), expect.any(AbortSignal));
    fireEvent.click(screen.getByRole("button", { name: "Ir a la página siguiente" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=3"), { scroll: false });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar categorías" }), { target: { value: "audio" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("search=audio"), { scroll: false });
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("page=1"), { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Estado" }), { target: { value: "INACTIVE" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(navigation.push).toHaveBeenCalledWith(expect.stringContaining("status=INACTIVE"), { scroll: false });
  });

  it("creates and edits a category with React Hook Form, Zod, flash and cache invalidation", async () => {
    const { invalidate } = renderManagement("categories");
    fireEvent.click(screen.getByRole("button", { name: "Nueva categoría" }));
    fireEvent.click(screen.getByRole("button", { name: "Crear categoría" }));
    expect(api.createClassification).not.toHaveBeenCalled();
    expect(await screen.findByText("Ingresa un nombre.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Audio" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción" }), { target: { value: "Equipos de sonido" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear categoría" }));
    await waitFor(() => expect(api.createClassification).toHaveBeenCalledWith("categories", "ADMIN-token", { name: "Audio", description: "Equipos de sonido" }));
    expect(await screen.findByText("Categoría creada.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["backoffice", "categories"] });

    const row = screen.getByText("Portátiles").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Editar Portátiles" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Notebooks" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar categoría" }));
    await waitFor(() => expect(api.updateClassification).toHaveBeenCalledWith("categories", "ADMIN-token", category.id, expect.objectContaining({ name: "Notebooks", slug: "portatiles" })));
    expect(await screen.findByText("Categoría actualizada.")).toBeInTheDocument();
  });

  it("shows safe mutation errors and leaves the form open", async () => {
    api.createClassification.mockRejectedValueOnce(new ClassificationApiError(409, "CLASSIFICATION_SLUG_ALREADY_EXISTS"));
    renderManagement("tags");
    fireEvent.click(screen.getByRole("button", { name: "Nueva etiqueta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Oferta" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), { target: { value: "gamer" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear etiqueta" }));
    expect(await screen.findByText("Ese slug ya está en uso.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Crear etiqueta" })).toBeInTheDocument();
  });

  it("creates and edits tags without category-only fields", async () => {
    api.createClassification.mockResolvedValue(tag);
    api.updateClassification.mockResolvedValue(tag);
    renderManagement("tags");
    fireEvent.click(screen.getByRole("button", { name: "Nueva etiqueta" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Gamer" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear etiqueta" }));
    await waitFor(() => expect(api.createClassification).toHaveBeenCalledWith("tags", "ADMIN-token", { name: "Gamer" }));
    expect(await screen.findByText("Etiqueta creada.")).toBeInTheDocument();
    const row = screen.getByText("Gamer").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Editar Gamer" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Gaming" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar etiqueta" }));
    await waitFor(() => expect(api.updateClassification).toHaveBeenCalledWith("tags", "ADMIN-token", tag.id, { name: "Gaming", slug: "gamer" }));
    expect(await screen.findByText("Etiqueta actualizada.")).toBeInTheDocument();
  });

  it("confirms destructive actions, cancels without a request and activates inactive tags", async () => {
    const user = userEvent.setup();
    renderManagement("tags");
    const row = (await screen.findByText("Gamer")).closest("tr")!;
    await user.click(within(row).getByRole("button", { name: "Eliminar Gamer" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.deleteClassification).not.toHaveBeenCalled();
    await user.click(within(row).getByRole("button", { name: "Eliminar Gamer" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Eliminar etiqueta" }));
    await waitFor(() => expect(api.deleteClassification).toHaveBeenCalledWith("tags", "ADMIN-token", tag.id));
    expect(await screen.findByText("Etiqueta eliminada lógicamente.")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Activar Gamer" }));
    await waitFor(() => expect(api.updateClassification).toHaveBeenCalledWith("tags", "ADMIN-token", tag.id, { status: "ACTIVE" }));
  });

  it("requires confirmation before deactivating a category", async () => {
    renderManagement("categories");
    const row = (await screen.findByText("Portátiles")).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Desactivar Portátiles" }));
    expect(api.updateClassification).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desactivar categoría" }));
    await waitFor(() => expect(api.updateClassification).toHaveBeenCalledWith("categories", "ADMIN-token", category.id, { status: "INACTIVE" }));
    expect(await screen.findByText("Categoría desactivada.")).toBeInTheDocument();
  });

  function installEditorialState(selectedCount: number) {
    let records: Category[] = Array.from({ length: 5 }, (_, index) => ({ ...category,
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`, name: `Categoría ${index + 1}`, slug: `categoria-${index + 1}`,
      status: index === 4 ? "INACTIVE" : "ACTIVE", showOnLanding: index < selectedCount, landingOrder: index < selectedCount ? index + 1 : null,
    }));
    api.listClassifications.mockImplementation(async (_kind, _token, query) => {
      const items = query.showOnLanding ? records.filter((record) => record.showOnLanding) : records;
      return { items, page: 1, pageSize: query.pageSize, totalItems: items.length, totalPages: items.length ? 1 : 0 };
    });
    api.updateClassification.mockImplementation(async (_kind, _token, id, input) => {
      const previous = records.find((record) => record.id === id)!;
      const position = input.landingOrder ?? (input.showOnLanding ? [1, 2, 3].find((slot) => !records.some((record) => record.landingOrder === slot)) : null);
      records = records.map((record) => record.id === id ? { ...record, showOnLanding: input.showOnLanding ?? record.showOnLanding, landingOrder: position }
        : input.landingOrder && record.landingOrder === position ? { ...record, landingOrder: previous.landingOrder } : record);
      return records.find((record) => record.id === id)!;
    });
    return records;
  }

  it("selects globally limited categories without downloading every page and invalidates landing", async () => {
    const records = installEditorialState(0);
    const { invalidate } = renderManagement("categories");
    expect(await screen.findByText(/Configuración incompleta/)).toBeInTheDocument();
    for (let index = 0; index < 3; index += 1) {
      const action = screen.getByRole("button", { name: `Incluir Categoría ${index + 1} en la landing` });
      await waitFor(() => expect(action).toBeEnabled());
      fireEvent.click(action);
      await screen.findByText(`${index + 1}/3 seleccionadas`);
    }
    expect(screen.getByRole("button", { name: "Incluir Categoría 4 en la landing" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Incluir Categoría 5 en la landing" })).toBeDisabled();
    expect(api.updateClassification).toHaveBeenCalledTimes(3);
    expect(api.updateClassification).toHaveBeenCalledWith("categories", "ADMIN-token", records[0]!.id, { showOnLanding: true });
    expect(api.listClassifications).toHaveBeenCalledWith("categories", "ADMIN-token", expect.objectContaining({ page: 1, pageSize: 3, showOnLanding: true, view: "administrative" }), expect.any(AbortSignal));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["catalog", "public", "landing"] });
    expect(screen.queryByText(/Configuración incompleta/)).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("swaps persisted positions with keyboard alternatives and drag without a multi-request rewrite", async () => {
    const records = installEditorialState(3);
    renderManagement("categories");
    const user = userEvent.setup();
    const up = await screen.findByRole("button", { name: "Subir Categoría 2" });
    await waitFor(() => expect(up).toBeEnabled());
    up.focus();
    await user.keyboard("{Enter}");
    await screen.findByText("Orden de categorías actualizado.");
    const list = screen.getByRole("list", { name: "Orden de categorías importantes" });
    await waitFor(() => expect(within(list).getAllByRole("listitem").map((item) => item.getAttribute("data-category-id"))).toEqual([records[1]!.id, records[0]!.id, records[2]!.id]));
    const handle = screen.getByRole("button", { name: "Arrastrar Categoría 3 para intercambiar posición" });
    await waitFor(() => expect(handle).toBeEnabled());
    fireEvent.dragStart(handle, { dataTransfer: { setData: vi.fn(), effectAllowed: "" } });
    fireEvent.dragOver(within(list).getAllByRole("listitem")[0]!);
    fireEvent.drop(within(list).getAllByRole("listitem")[0]!);
    await waitFor(() => expect(api.updateClassification).toHaveBeenCalledTimes(2));
    expect(api.updateClassification.mock.calls[1]).toEqual(["categories", "ADMIN-token", records[2]!.id, { landingOrder: 1 }]);
    await waitFor(() => expect(within(list).getAllByRole("listitem")[0]).toHaveAttribute("data-category-id", records[2]!.id));
  });

  it("warns before withdrawing an incomplete configuration and cancels without mutating", async () => {
    const records = installEditorialState(2);
    renderManagement("categories");
    const list = await screen.findByRole("list", { name: "Orden de categorías importantes" });
    const withdraw = within(list).getByRole("button", { name: "Retirar Categoría 1 de la landing" });
    await waitFor(() => expect(withdraw).toBeEnabled());
    fireEvent.click(withdraw);
    expect(within(screen.getByRole("dialog")).getByText(/La configuración quedará incompleta/)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(api.updateClassification).not.toHaveBeenCalled();
    fireEvent.click(withdraw);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Retirar de la landing" }));
    await screen.findByText("Categoría retirada de la landing.");
    await screen.findByText(/Configuración incompleta/);
    expect(api.updateClassification).toHaveBeenCalledWith("categories", "ADMIN-token", records[0]!.id, { showOnLanding: false });
    expect(api.deleteClassification).not.toHaveBeenCalled();
  });

  it("handles a concurrent fourth selection with a safe error and does not duplicate pending writes", async () => {
    installEditorialState(2);
    renderManagement("categories");
    const action = await screen.findByRole("button", { name: "Incluir Categoría 3 en la landing" });
    await waitFor(() => expect(action).toBeEnabled());
    api.updateClassification.mockRejectedValueOnce(new ClassificationApiError(409, "CATEGORY_LANDING_LIMIT_EXCEEDED"));
    fireEvent.click(action);
    await screen.findByText("Solo puedes seleccionar hasta tres categorías. Retira una antes de añadir otra.");
    await waitFor(() => expect(action).toBeEnabled());
    api.updateClassification.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.click(action);
    await waitFor(() => expect(action).toBeDisabled());
    fireEvent.click(action);
    expect(api.updateClassification).toHaveBeenCalledTimes(2);
    expect(screen.getByText("2/3 seleccionadas")).toBeInTheDocument();
  });

  it.each(["BILLING", "CUSTOMER"] as const)("denies %s without requesting classifications", (role) => {
    setSession(role);
    renderManagement("categories");
    expect(screen.getByText("Tu rol no puede administrar categorías.")).toBeInTheDocument();
    expect(api.listClassifications).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors without loading classifications", async () => {
    setSession(null);
    renderManagement("tags");
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/login"));
    expect(api.listClassifications).not.toHaveBeenCalled();
  });
});
