import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { RemoteAutocomplete } from "@technology-ecommerce/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRemoteAutocomplete } from "../src/hooks/use-remote-autocomplete";

function provider() {
  const client = new QueryClient();
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> };
}
async function tick(ms = 250) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  // Query notifications are scheduled after React commits the settled term.
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
}

describe("remote autocomplete hook", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces trimmed terms, skips short searches, and reuses a scoped cache", async () => {
    const { client, wrapper } = provider();
    const loadOptions = vi.fn(async (search: string) => [{ id: search }]);
    const { result, unmount } = renderHook(() => useRemoteAutocomplete({ scope: ["products", "admin-one"], loadOptions }), { wrapper });
    act(() => result.current.setSearch("te"));
    await tick();
    expect(loadOptions).not.toHaveBeenCalled();
    act(() => result.current.setSearch("tec"));
    await tick(200);
    act(() => result.current.setSearch("  teclado  "));
    expect(result.current.loading).toBe(true);
    await tick(249);
    expect(loadOptions).not.toHaveBeenCalled();
    await tick(2);
    expect(loadOptions).toHaveBeenCalledWith("teclado", expect.any(AbortSignal));
    expect(result.current.options).toEqual([{ id: "teclado" }]);
    act(() => result.current.setSearch("mouse"));
    expect(result.current.options).toEqual([]);
    await tick(251);
    act(() => result.current.setSearch("teclado"));
    await tick(251);
    expect(result.current.options).toEqual([{ id: "teclado" }]);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    unmount();
    client.clear();
  });

  it("aborts obsolete requests immediately and ignores a late response", async () => {
    const { client, wrapper } = provider();
    let resolveOld!: (items: { id: string }[]) => void;
    const signals: AbortSignal[] = [];
    const loadOptions = vi.fn((search: string, signal: AbortSignal) => {
      signals.push(signal);
      return search === "old" ? new Promise<{ id: string }[]>((resolve) => { resolveOld = resolve; }) : Promise.resolve([{ id: search }]);
    });
    const { result, unmount } = renderHook(() => useRemoteAutocomplete({ scope: ["customers", "billing-one"], loadOptions }), { wrapper });
    act(() => result.current.setSearch("old"));
    await tick(251);
    act(() => result.current.setSearch("new"));
    expect(signals[0]!.aborted).toBe(true);
    await tick(251);
    await act(async () => resolveOld([{ id: "obsolete" }]));
    expect(result.current.options).toEqual([{ id: "new" }]);
    unmount();
    client.clear();
  });

  it("aborts on unmount and disabling", async () => {
    const { client, wrapper } = provider();
    const signals: AbortSignal[] = [];
    const loadOptions = vi.fn((_search: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<readonly string[]>(() => {});
    });
    const { result, rerender, unmount } = renderHook(({ enabled, account }) => useRemoteAutocomplete({ scope: ["customers", account], loadOptions, enabled }), { wrapper, initialProps: { enabled: true, account: "one" } });
    act(() => result.current.setSearch("customer"));
    await tick(251);
    rerender({ enabled: false, account: "one" });
    expect(signals[0]!.aborted).toBe(true);
    expect(result.current.options).toEqual([]);
    rerender({ enabled: true, account: "two" });
    await tick(1);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(result.current.options).toEqual([]);
    unmount();
    expect(signals[1]!.aborted).toBe(true);
    client.clear();
  });

  it("never displays cached customer results from another account", async () => {
    const { client, wrapper } = provider();
    const loadOptions = vi.fn().mockResolvedValueOnce([{ id: "private-one" }]).mockResolvedValueOnce([{ id: "private-two" }]);
    const { result, rerender, unmount } = renderHook(({ account }) => useRemoteAutocomplete({ scope: ["customers", account], loadOptions }), { wrapper, initialProps: { account: "one" } });
    act(() => result.current.setSearch("customer"));
    await tick(251);
    expect(result.current.options).toEqual([{ id: "private-one" }]);
    rerender({ account: "two" });
    expect(result.current.options).toEqual([]);
    await tick(1);
    expect(result.current.options).toEqual([{ id: "private-two" }]);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    unmount();
    client.clear();
  });

  it("exposes safe error state and supports an explicit retry", async () => {
    const { client, wrapper } = provider();
    const loadOptions = vi.fn().mockRejectedValueOnce(new Error("private server detail")).mockResolvedValueOnce([{ id: "confirmed" }]);
    const { result, unmount } = renderHook(() => useRemoteAutocomplete({ scope: ["customers", "one"], loadOptions }), { wrapper });
    act(() => result.current.setSearch("customer"));
    await tick(251);
    expect(result.current.error).toBe(true);
    expect(result.current.options).toEqual([]);
    act(() => result.current.retry());
    await tick(1);
    expect(result.current.error).toBe(false);
    expect(result.current.options).toEqual([{ id: "confirmed" }]);
    unmount();
    client.clear();
  });

  it("connects the remote hook to an accessible selector without submitting text as a selection", async () => {
    const { client, wrapper } = provider();
    const loadOptions = vi.fn(async () => [{ id: "product-one", name: "Teclado Nova" }]);
    const onSelect = vi.fn();
    function Selector() {
      const lookup = useRemoteAutocomplete({ scope: ["products", "admin"], loadOptions });
      return <RemoteAutocomplete label="Producto" {...lookup} onSearchChange={lookup.setSearch}
        optionKey={(item) => item.id} optionLabel={(item) => item.name} onSelect={onSelect} />;
    }
    const { unmount } = render(<Selector />, { wrapper });
    const input = screen.getByRole("combobox", { name: "Producto" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "tec" } });
    expect(screen.getByRole("status")).toHaveTextContent("Buscando");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(onSelect).not.toHaveBeenCalled();
    await tick(251);
    expect(screen.getByRole("option")).toHaveTextContent("Teclado Nova");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith({ id: "product-one", name: "Teclado Nova" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    unmount();
    client.clear();
  });
});
