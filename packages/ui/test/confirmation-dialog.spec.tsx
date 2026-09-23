import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationDialog } from "../src";

function ConfirmationExample({ onConfirm }: Readonly<{ onConfirm: () => void }>) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)} type="button">Eliminar producto</button>
      <ConfirmationDialog
        description="El producto dejará de aparecer en el catálogo."
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
        open={open}
        title="¿Eliminar este producto?"
      />
    </div>
  );
}

describe("destructive confirmation dialog", () => {
  it("isolates the background, traps focus and restores it after Escape", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { container } = render(<ConfirmationExample onConfirm={onConfirm} />);
    const opener = screen.getByRole("button", { name: "Eliminar producto" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "¿Eliminar este producto?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("El producto dejará de aparecer en el catálogo.");
    expect(container).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
    expect(container).not.toHaveAttribute("inert");
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("cancels without sending the destructive operation", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmationExample onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Eliminar producto" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("blocks rapid duplicate confirmations and all dismissal while pending", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const props = {
      description: "Esta acción se enviará una sola vez.",
      onCancel,
      onConfirm,
      open: true,
      title: "Confirmar eliminación",
    };
    const { rerender } = render(<ConfirmationDialog {...props} />);
    const confirm = screen.getByRole("button", { name: "Confirmar" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();

    rerender(<ConfirmationDialog {...props} isPending />);
    expect(screen.getByRole("button", { name: "Procesando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(document.querySelector('[data-slot="confirmation-dialog-backdrop"]')!);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
