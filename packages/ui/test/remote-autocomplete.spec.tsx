import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { RemoteAutocomplete } from "../src";

const options = [
  { id: "one", name: "Teclado Nova", detail: "SKU NOVA · USD 89.00" },
  { id: "two", name: "Teclado Atlas", detail: "SKU ATLAS · USD 99.00" },
];
const defaults = {
  label: "Producto", optionKey: (item: typeof options[number]) => item.id,
  optionLabel: (item: typeof options[number]) => item.name,
  optionDescription: (item: typeof options[number]) => item.detail,
};

describe("remote autocomplete primitive", () => {
  it("keeps focus on the named combobox and supports arrows, Home, End, Enter and Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    function Example() {
      const [search, setSearch] = useState("tec");
      return <RemoteAutocomplete {...defaults} search={search} onSearchChange={setSearch} options={options} onSelect={onSelect} />;
    }
    render(<Example />);
    const input = screen.getByRole("combobox", { name: "Producto" });
    expect(input).toHaveAccessibleDescription("2 resultados. Usa las flechas y Enter para seleccionar.");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(input.getAttribute("aria-controls")!)).toHaveAttribute("role", "listbox");
    await user.keyboard("{ArrowDown}");
    expect(document.getElementById(input.getAttribute("aria-activedescendant")!)).toHaveTextContent("Teclado Nova");
    await user.keyboard("{End}");
    expect(screen.getByRole("option", { name: /Teclado Atlas/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}{ArrowUp}");
    expect(screen.getByRole("option", { name: /Teclado Atlas/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(options[1]);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("selects by pointer without submitting a surrounding form and closes on Tab", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSubmit = vi.fn((event) => event.preventDefault());
    const onBlur = vi.fn();
    render(<form onSubmit={onSubmit}><RemoteAutocomplete {...defaults} search="tec" onSearchChange={vi.fn()} options={options} onSelect={onSelect} onBlur={onBlur} /><button type="submit">Guardar</button></form>);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.click(screen.getByRole("option", { name: /Teclado Nova/ }));
    expect(onSelect).toHaveBeenCalledWith(options[0]);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.keyboard("{ArrowDown}{Tab}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toHaveFocus();
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it("announces minimum term, loading, empty and safe error states, with retry and field validation", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const props = { ...defaults, onSearchChange: vi.fn(), onSelect: vi.fn(), options };
    const { rerender } = render(<RemoteAutocomplete {...props} search="te" />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    expect(screen.getByRole("status")).toHaveTextContent("al menos 3 caracteres");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    rerender(<RemoteAutocomplete {...props} search="tec" loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Buscando");
    expect(screen.getByRole("listbox")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    rerender(<RemoteAutocomplete {...props} search="tec" options={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No hay coincidencias");
    rerender(<RemoteAutocomplete {...props} search="tec" error onRetry={onRetry} validationError="Selecciona un producto." />);
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo realizar la búsqueda");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Selecciona un producto/);
    await user.click(screen.getByRole("button", { name: "Reintentar búsqueda" }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<RemoteAutocomplete {...props} search="tec" disabled />);
    expect(input).toBeDisabled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("discards an active option that disappears rather than selecting an unrelated result", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const props = { ...defaults, search: "tec", onSearchChange: vi.fn(), onSelect };
    const { rerender } = render(<RemoteAutocomplete {...props} options={options} />);
    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    rerender(<RemoteAutocomplete {...props} options={[options[1]!]} />);
    expect(input).not.toHaveAttribute("aria-activedescendant");
    await user.keyboard("{Enter}");
    expect(onSelect).not.toHaveBeenCalled();
  });
});
