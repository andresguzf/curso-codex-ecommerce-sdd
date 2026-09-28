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
    api.listClassifications.mockImplementation(async (kind: string) => ({ items: kind === "categories" ? [category] : [tag], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 }));
    api.createClassification.mockResolvedValue(category);
    api.updateClassification.mockResolvedValue(category);
    api.deleteClassification.mockResolvedValue(undefined);
  });

  it("requests one backend page and keeps search, filters and pagination in the URL", async () => {
    navigation.searchParams = new URLSearchParams("page=2&search=port&status=ACTIVE&pageSize=10&sortBy=name&sortOrder=asc");
    api.listClassifications.mockResolvedValue({ items: [category], page: 2, pageSize: 10, totalItems: 24, totalPages: 3 });
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
