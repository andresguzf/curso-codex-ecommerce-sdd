import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectThemeStore, createThemeStore, ThemeProvider } from "../src/theme-provider";
import { themeBootstrapScript, themeStorageKey } from "../src/theme-bootstrap";

let dark = false;
let change: (() => void) | undefined;
const remove = vi.fn();
beforeEach(() => {
  dark = false;
  change = undefined;
  remove.mockClear();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    get matches() { return dark; },
    addEventListener: (_name: string, listener: () => void) => { change = listener; },
    removeEventListener: remove,
  })));
});

describe("independent visual themes", () => {
  it("bootstraps the system preference before mounting and honors valid saved choices", () => {
    dark = true;
    new Function(themeBootstrapScript("storefront"))();
    expect(document.documentElement.dataset.theme).toBe("dark");
    localStorage.setItem(themeStorageKey("storefront"), "light");
    new Function(themeBootstrapScript("storefront"))();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.dataset.designSystem).toBe("storefront");
  });
  it("follows the system only until an explicit selection and cleans subscriptions", () => {
    const store = createThemeStore();
    const disconnect = connectThemeStore(store, "backoffice");
    dark = true;
    change?.();
    expect(store.getState().theme).toBe("dark");
    expect(localStorage.getItem(themeStorageKey("backoffice"))).toBeNull();
    store.getState().setTheme("light");
    change?.();
    expect(store.getState().theme).toBe("light");
    expect(localStorage.getItem(themeStorageKey("backoffice"))).toBe("light");
    disconnect();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("ignores another application's storage events and handles cleared preferences", () => {
    const store = createThemeStore();
    const disconnect = connectThemeStore(store, "storefront");
    window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey("backoffice"), newValue: "dark" }));
    expect(store.getState().theme).toBe("light");
    window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey("storefront"), newValue: "dark" }));
    expect(store.getState().theme).toBe("dark");
    window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey("storefront"), newValue: null }));
    expect(store.getState().theme).toBe("light");
    disconnect();
  });
  it("ignores corrupt preferences and tolerates unavailable storage", () => {
    localStorage.setItem(themeStorageKey("storefront"), "invalid");
    dark = true;
    const store = createThemeStore();
    const disconnect = connectThemeStore(store, "storefront");
    expect(store.getState().theme).toBe("dark");
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    store.getState().setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    spy.mockRestore();
    disconnect();
  });
  it("bootstraps and mounts when storage reads are blocked", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    dark = true;
    new Function(themeBootstrapScript("backoffice"))();
    expect(document.documentElement.dataset.theme).toBe("dark");
    const store = createThemeStore();
    const disconnect = connectThemeStore(store, "backoffice");
    expect(store.getState()).toMatchObject({ ready: true, theme: "dark" });
    disconnect();
    spy.mockRestore();
  });
  it("exposes a keyboard operable pressed-state toggle with application-specific persistence", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider application="storefront"><p>Catálogo</p></ThemeProvider>);
    const toggle = screen.getByRole("button", { name: "Tema oscuro" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.tab();
    await user.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(themeStorageKey("storefront"))).toBe("dark");
    expect(localStorage.getItem(themeStorageKey("backoffice"))).toBeNull();
  });
});
