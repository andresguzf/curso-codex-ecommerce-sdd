import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManualInvoiceForm } from "../src/features/invoices/manual-invoice-form";

const api = vi.hoisted(() => ({ searchInvoiceCustomers: vi.fn(), searchInvoiceProducts: vi.fn() }));
vi.mock("../src/features/invoices/invoice-autocomplete-api", () => api);
const customers = [
  { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e4", displayName: "Cliente Uno", email: "one@example.com" },
  { id: "3296f1d5-5a1d-4b94-9caa-b26878f447e5", displayName: "Cliente Dos", email: "two@example.com" },
];
const products = [
  { id: "421d45a3-104e-4413-b79f-25290d1cb0a3", name: "Teclado Nova", description: "Teclado mecánico", sku: "NOVA", price: "89.5" },
  { id: "421d45a3-104e-4413-b79f-25290d1cb0a4", name: "Teclado Atlas", description: "Teclado compacto", sku: "ATLAS", price: "120.00" },
];
function mount(role = "ADMIN") {
  const onSubmit = vi.fn();
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><ManualInvoiceForm accountId={`account-${role}`} accessToken={`${role}-token`} isPending={false} onCancel={vi.fn()} onSubmit={onSubmit} /></QueryClientProvider>);
  return onSubmit;
}
async function select(label: string, term: string, option: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value: term } });
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option) }));
}
beforeEach(() => {
  vi.clearAllMocks();
  api.searchInvoiceCustomers.mockResolvedValue(customers);
  api.searchInvoiceProducts.mockResolvedValue(products);
});

describe("manual invoice remote selectors", () => {
  it.each(["ADMIN", "BILLING"])("submits confirmed IDs and current prices for %s using the keyboard", async (role) => {
    const user = userEvent.setup();
    const submit = mount(role);
    const customer = screen.getByRole("combobox", { name: "Cliente" });
    await user.type(customer, "Cliente");
    await screen.findByRole("option", { name: /Cliente Uno/ });
    await user.keyboard("{ArrowDown}{Enter}");
    const product = screen.getByRole("combobox", { name: "Producto (opcional)" });
    await user.type(product, "Teclado");
    await screen.findByRole("option", { name: /Teclado Nova/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(screen.getByLabelText("Nombre")).toHaveValue("Teclado Nova");
    expect(screen.getByLabelText("Nombre")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Precio unitario (USD)")).toHaveValue("89.50");
    await user.click(screen.getByRole("button", { name: "Crear factura manual" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith({ customerId: customers[0]!.id, shippingTotal: "0.00", lines: [{ productId: products[0]!.id, quantity: 1, unitPrice: "89.50", taxRate: "0.0000" }] }));
    expect(api.searchInvoiceCustomers).toHaveBeenCalledWith(`${role}-token`, "Cliente", expect.any(AbortSignal));
    expect(api.searchInvoiceProducts).toHaveBeenCalledWith(`${role}-token`, "Teclado", expect.any(AbortSignal));
  });

  it("invalidates cleared selections, supports changing both IDs and validates quantities", async () => {
    const submit = mount();
    await select("Cliente", "Cliente", "Cliente Uno");
    await select("Producto (opcional)", "Teclado", "Teclado Nova");
    expect(screen.getByRole("button", { name: "Cambiar producto (opcional)" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar cliente" }));
    expect(screen.getByRole("combobox", { name: "Cliente" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    expect(await screen.findByText("Selecciona un cliente de los resultados.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    await select("Cliente", "Cliente", "Cliente Dos");
    fireEvent.click(screen.getByRole("button", { name: "Cambiar producto (opcional)" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("");
    expect(screen.getByLabelText("Precio unitario (USD)")).toHaveValue("");
    await select("Producto (opcional)", "Teclado", "Teclado Atlas");
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    expect(await screen.findByText("La cantidad debe ser mayor que cero.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Cantidad"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ customerId: customers[1]!.id, lines: [expect.objectContaining({ productId: products[1]!.id, quantity: 2, unitPrice: "120.00" })] })));
  });

  it("preserves the remaining product after deleting a preceding line", async () => {
    const submit = mount();
    await select("Cliente", "Cliente", "Cliente Uno");
    fireEvent.click(screen.getByRole("button", { name: "+ Agregar línea" }));
    const line = screen.getByText("Línea 2").parentElement!.parentElement!;
    fireEvent.change(within(line).getByRole("combobox"), { target: { value: "Teclado" } });
    fireEvent.click(await within(line).findByRole("option", { name: /Teclado Atlas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Quitar línea 1" }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Teclado Atlas");
    expect(screen.getByText("ATLAS · USD 120.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ productId: products[1]!.id })] })));
  });

  it("does not treat typed search text as a confirmed customer", async () => {
    const submit = mount();
    fireEvent.change(screen.getByRole("combobox", { name: "Cliente" }), { target: { value: customers[0]!.id } });
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Servicio" } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Instalación" } });
    fireEvent.change(screen.getByLabelText("Precio unitario (USD)"), { target: { value: "30.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear factura manual" }));
    expect(await screen.findByText("Selecciona un cliente de los resultados.")).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });
});
