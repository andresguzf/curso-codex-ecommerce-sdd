import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AuthRole, StoreProfile } from "@technology-ecommerce/api-schemas";
import { FlashRegion, useFlashStore } from "@technology-ecommerce/ui";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionStore } from "../src/features/auth/session";
import { StoreProfileManagement } from "../src/features/store-profile/store-profile-management";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const api = vi.hoisted(() => ({ getStoreProfile: vi.fn(), saveStoreProfile: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("../src/features/store-profile/store-profile-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/features/store-profile/store-profile-api")>(),
  ...api,
}));

const profile: StoreProfile = {
  id: 1,
  tradeName: "Nexo Tech",
  legalName: "Nexo Tecnología SpA",
  taxIdentifier: "76.123.456-7",
  address: { line1: "Av. Principal 123", line2: null, city: "Santiago", region: "RM", postalCode: "8320000", countryCode: "CL" },
  contact: { email: "empresa@example.com", phone: "+56 2 1234 5678" },
  logo: { storageKey: "logos/nexo.svg", url: "https://example.com/nexo.svg" },
  createdAt: "2026-09-01T12:00:00.000Z",
  updatedAt: "2026-09-20T12:00:00.000Z",
};

function setSession(role: AuthRole) {
  useSessionStore.setState({
    status: "authenticated",
    session: {
      accessToken: `${role}-token`, tokenType: "Bearer",
      accessTokenExpiresAt: "2026-09-30T12:00:00.000Z",
      sessionExpiresAt: "2026-09-30T12:00:00.000Z",
      user: { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Ana", email: "ana@example.com", role },
    },
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><StoreProfileManagement /><FlashRegion appearance="backoffice" /></QueryClientProvider>);
}

describe("perfil empresarial en backoffice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFlashStore.getState().dismissFlash();
    setSession("ADMIN");
    api.getStoreProfile.mockResolvedValue(profile);
    api.saveStoreProfile.mockResolvedValue({ ...profile, updatedAt: "2026-09-21T12:00:00.000Z" });
  });

  it("precarga los campos, permite elegir logo alojado y guarda con flash", async () => {
    renderPage();
    expect(await screen.findByDisplayValue("Nexo Tecnología SpA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("logos/nexo.svg")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/nexo.svg")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Nombre comercial" }), { target: { value: "Nexo Plus" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil empresarial" }));
    await waitFor(() => expect(api.saveStoreProfile).toHaveBeenCalledWith("ADMIN-token", expect.objectContaining({
      tradeName: "Nexo Plus",
      logo: { storageKey: "logos/nexo.svg", url: "https://example.com/nexo.svg" },
    })));
    expect(await screen.findByText("Perfil empresarial guardado.")).toBeInTheDocument();
  });

  it("valida campos requeridos y logo antes de llamar al API", async () => {
    api.getStoreProfile.mockResolvedValue(null);
    renderPage();
    await screen.findByText("Pendiente de configuración");
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil empresarial" }));
    expect(await screen.findByText("Ingresa la razón social.")).toHaveAttribute("role", "alert");
    expect(api.saveStoreProfile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Usar logo alojado" }));
    fireEvent.change(screen.getByRole("textbox", { name: "URL del logo" }), { target: { value: "not-a-url" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil empresarial" }));
    expect(await screen.findByText("Ingresa una URL HTTP o HTTPS válida.")).toHaveAttribute("role", "alert");
    expect(api.saveStoreProfile).not.toHaveBeenCalled();
  });

  it("permite lectura a BILLING sin controles de edición", async () => {
    setSession("BILLING");
    renderPage();
    expect(await screen.findByText("Nexo Tecnología SpA")).toBeInTheDocument();
    expect(api.getStoreProfile).toHaveBeenCalledWith("BILLING-token", expect.any(AbortSignal));
    expect(screen.queryByRole("button", { name: "Guardar perfil empresarial" })).not.toBeInTheDocument();
    expect(api.saveStoreProfile).not.toHaveBeenCalled();
  });

  it("no consulta información empresarial para CUSTOMER", () => {
    setSession("CUSTOMER");
    renderPage();
    expect(screen.getByText("Tu rol no puede consultar el perfil empresarial.")).toBeInTheDocument();
    expect(api.getStoreProfile).not.toHaveBeenCalled();
  });
});
