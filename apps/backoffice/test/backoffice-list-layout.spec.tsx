import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackofficeListLayout, BackofficeListSearch } from "../src/components/backoffice-list-layout";

const originalMatchMedia = window.matchMedia;

function setCompactViewport(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((media: string) => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media,
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  });
}

function LayoutHarness() {
  const [open, setOpen] = useState(false);

  return (
    <BackofficeListLayout
      filters={<label>Estado<select aria-label="Estado"><option>Todos</option><option>Activo</option></select></label>}
      filtersOpen={open}
      filtersTitle="Filtros administrativos"
      onFiltersOpenChange={setOpen}
      search={<BackofficeListSearch label="Buscar productos" onSearch={vi.fn()} placeholder="Nombre o SKU" />}
    >
      <table aria-label="Productos"><tbody><tr><td>Equipo de ejemplo</td></tr></tbody></table>
    </BackofficeListLayout>
  );
}

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
  else Reflect.deleteProperty(window, "matchMedia");
});

describe("backoffice list layout", () => {
  it("keeps one search slot above the list and controls the collapsible filter panel", async () => {
    setCompactViewport(false);
    render(<LayoutHarness />);

    expect(screen.getByRole("search", { name: "Buscar productos" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Productos" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    const desktopPanel = document.querySelector('[data-slot="collapsible-side-panel"]');
    await waitFor(() => expect(desktopPanel).toHaveAttribute("data-open", "true"));
    expect(screen.getByRole("button", { name: "Ocultar filtros" })).toHaveAttribute("aria-expanded", "true");
  });

  it("opens a right-side accessible drawer on compact screens and closes it with Escape", async () => {
    setCompactViewport(true);
    render(<LayoutHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros" }));
    const drawer = await screen.findByRole("dialog", { name: "Filtros administrativos" });
    await waitFor(() => expect(drawer).toHaveClass("right-0"));
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(drawer.id).toBe(screen.getByRole("button", { name: "Ocultar filtros" }).getAttribute("aria-controls"));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(drawer.closest('[data-slot="filter-drawer"]')).toHaveClass("hidden"));
  });
});
