import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  CollapsibleSidePanel,
  ConfirmationDialog,
  DataTable,
  ErrorState,
  FilterDrawer,
  getPaginationItems,
  IconButton,
  LoadingState,
  Navigation,
  Pagination,
  TextField,
  type DataTableColumn,
} from "../src";

describe("shared UI primitives", () => {
  it("renders navigation with a named region and current location", () => {
    render(
      <Navigation
        ariaLabel="Navegación principal"
        items={[
          { current: true, href: "/", label: "Inicio" },
          { badge: 3, badgeLabel: "3 productos", href: "/cart", label: "Carrito" },
        ]}
      />,
    );

    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByLabelText("3 productos")).toHaveTextContent("3");
  });

  it("keeps icon-only actions discoverable with an accessible label and tooltip", () => {
    render(<IconButton icon="trash" label="Eliminar" />);

    const button = screen.getByRole("button", { name: "Eliminar" });
    expect(button).toHaveAttribute("title", "Eliminar");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("connects a form field to its hint and accessible error", () => {
    render(
      <TextField
        error="El SKU es obligatorio."
        hint="Usa el identificador visible en inventario."
        id="sku"
        label="SKU"
        name="sku"
      />,
    );

    const input = screen.getByRole("textbox", { name: "SKU" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Usa el identificador visible en inventario. El SKU es obligatorio.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("El SKU es obligatorio.");
  });

  it("renders a captioned table and a useful empty state", () => {
    type Product = Readonly<{ id: string; name: string }>;
    const columns: readonly DataTableColumn<Product>[] = [
      { cell: (product) => product.name, header: "Producto", id: "name" },
    ];
    const { rerender } = render(
      <DataTable
        caption="Productos del catálogo"
        columns={columns}
        rowKey={(product) => product.id}
        rows={[{ id: "one", name: "Notebook Atlas" }]}
      />,
    );

    expect(screen.getByRole("table", { name: "Productos del catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Producto" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Notebook Atlas" })).toBeInTheDocument();

    rerender(
      <DataTable
        caption="Productos del catálogo"
        columns={columns}
        emptyMessage="No encontramos productos."
        rowKey={(product) => product.id}
        rows={[]}
      />,
    );
    expect(screen.getByRole("cell", { name: "No encontramos productos." })).toBeInTheDocument();
  });

  it("announces loading and error states", () => {
    render(
      <>
        <LoadingState message="Cargando inventario…" />
        <ErrorState message="Revisa tu conexión e inténtalo nuevamente." />
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Cargando inventario…");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Revisa tu conexión e inténtalo nuevamente.",
    );
  });

  it("focuses the safe modal action and supports cancel and confirm", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        description="El producto dejará de aparecer en el catálogo."
        onCancel={onCancel}
        onConfirm={onConfirm}
        open
        title="Desactivar producto"
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Desactivar producto" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("renders filters in a left horizontal drawer and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <FilterDrawer onClose={onClose} open title="Filtros del catálogo">
        <p>Disponibilidad</p>
      </FilterDrawer>,
    );

    const drawer = screen.getByRole("dialog", { name: "Filtros del catálogo" });
    expect(drawer).toHaveClass("left-0");
    expect(drawer).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps an administrative filter panel beside the content and collapses it by width", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CollapsibleSidePanel onClose={onClose} open title="Filtros y orden">
        <label>Estado<select aria-label="Estado"><option>Todos</option></select></label>
      </CollapsibleSidePanel>,
    );

    const panel = screen.getByText("Filtros y orden").closest("aside");
    expect(panel).toHaveAttribute("data-open", "true");
    expect(panel).toHaveClass("w-[min(100%,19rem)]");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the first page, four following pages, the last page and one ellipsis", () => {
    render(<Pagination onPageChange={vi.fn()} page={1} totalPages={20} />);

    expect(screen.getByRole("button", { name: "Página 1, actual" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Ir a la página 5" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a la página 6" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la página 20" })).toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ir a la primera página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ir a la página anterior" })).toBeDisabled();
  });

  it("shows four pages on each side of an intermediate page and both ellipses", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <Pagination onPageChange={onPageChange} page={10} totalPages={20} />,
    );

    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeInTheDocument();
    expect(screen.getByText("Página 10 de 20")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la página 6" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la página 14" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a la página 5" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a la página 15" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Ir a la página anterior" }));
    await user.click(screen.getByRole("button", { name: "Ir a la página 12" }));
    await user.click(screen.getByRole("button", { name: "Ir a la última página" }));
    expect(onPageChange.mock.calls).toEqual([[9], [12], [20]]);
  });

  it("bounds the final page and keeps the preceding four pages visible", () => {
    render(<Pagination onPageChange={vi.fn()} page={20} totalPages={20} />);

    expect(screen.getByRole("button", { name: "Página 20, actual" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Ir a la página 16" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ir a la página 15" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ir a la página siguiente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ir a la última página" })).toBeDisabled();
  });

  it("renders a stable single-page result without ellipses", () => {
    render(<Pagination onPageChange={vi.fn()} page={1} totalPages={1} />);

    expect(getPaginationItems(1, 1)).toEqual([1]);
    expect(screen.getByRole("button", { name: "Página 1, actual" })).toBeDisabled();
    expect(screen.queryByText("…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir a la primera página" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ir a la última página" })).toBeDisabled();
  });
});
