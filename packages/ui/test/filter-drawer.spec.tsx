import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterDrawer } from "../src";

function Example() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)} type="button">Filtros</button>
      <a href="#other">Fuera del panel</a>
      <FilterDrawer onClose={() => setOpen(false)} open={open} title="Filtros de prueba">
        <label>Buscar<input /></label>
        <button type="button">Aplicar</button>
      </FilterDrawer>
    </div>
  );
}

describe("filter drawer accessibility", () => {
  it("portals above the shell, isolates the background, traps and restores focus and scroll", async () => {
    const user = userEvent.setup();
    document.body.style.overflow = "auto";
    const { container } = render(<Example />);
    const opener = screen.getByRole("button", { name: "Filtros" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Filtros de prueba" });
    expect(container).not.toContainElement(dialog);
    expect(container).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Aplicar" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    // Imperative focus attempts must not escape the modal either.
    container.querySelector("a")?.focus();
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(opener).toHaveFocus());
    expect(container).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("preserves preexisting inert state and restores scroll on unmount", () => {
    const sibling = document.createElement("div");
    sibling.setAttribute("inert", "");
    document.body.append(sibling);
    document.body.style.overflow = "auto";
    const { unmount } = render(<FilterDrawer onClose={vi.fn()} open title="Filtros">Contenido</FilterDrawer>);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(sibling).toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("auto");
    sibling.remove();
    document.body.style.overflow = "";
  });
});
