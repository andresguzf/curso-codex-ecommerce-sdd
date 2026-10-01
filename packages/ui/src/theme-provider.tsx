"use client";

import { useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";

import { ThemeIcon } from "./theme-icon";
import { themeStorageKey, type Theme, type ThemeApplication } from "./theme-bootstrap";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function createThemeStore() {
  return create<{
    theme: Theme;
    ready: boolean;
    setTheme: (theme: Theme) => void;
  }>((set) => ({ theme: "light", ready: false, setTheme: (theme) => set({ theme }) }));
}

/** Attach only after mounting: creating the store remains pure and SSR-safe. */
export function connectThemeStore(store: ReturnType<typeof createThemeStore>, application: ThemeApplication) {
  const key = themeStorageKey(application);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let preference: Theme | null = null;
  try {
    const saved = window.localStorage.getItem(key);
    preference = isTheme(saved) ? saved : null;
  } catch { /* Storage can be disabled; system and in-memory selection still work. */ }

  function apply(theme: Theme) {
    const root = document.documentElement;
    root.dataset.designSystem = application;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  }
  const initial = preference ?? (media.matches ? "dark" : "light");
  apply(initial);
  store.setState({ theme: initial, ready: true });
  // External changes must not become explicit choices or echo storage events.
  let syncing = false;
  const stop = store.subscribe((state, previous) => {
    if (state.theme === previous.theme || syncing) return;
    preference = state.theme;
    apply(state.theme);
    try { window.localStorage.setItem(key, state.theme); } catch { /* Optional persistence. */ }
  });
  function receive(theme: Theme) {
    syncing = true;
    apply(theme);
    store.setState({ theme });
    syncing = false;
  }
  function systemChanged() {
    if (!preference) receive(media.matches ? "dark" : "light");
  }
  function storageChanged(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    preference = isTheme(event.newValue) ? event.newValue : null;
    receive(preference ?? (media.matches ? "dark" : "light"));
  }
  media.addEventListener("change", systemChanged);
  window.addEventListener("storage", storageChanged);
  return () => {
    stop();
    media.removeEventListener("change", systemChanged);
    window.removeEventListener("storage", storageChanged);
  };
}

export function ThemeProvider({ application, children }: Readonly<{ application: ThemeApplication; children: ReactNode }>) {
  const [store] = useState(createThemeStore);
  const theme = store((state) => state.theme);
  const ready = store((state) => state.ready);
  const setTheme = store((state) => state.setTheme);
  useEffect(() => connectThemeStore(store, application), [application, store]);

  return <>
    {children}
    <button
      aria-label="Tema oscuro"
      aria-pressed={theme === "dark"}
      disabled={!ready}
      className="fixed bottom-5 right-5 z-40 inline-flex size-11 items-center justify-center rounded-full border border-[var(--ds-border)] bg-[var(--ds-surface)] text-[var(--ds-text)] shadow-lg transition-transform hover:scale-110 motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ds-focus)]"
      style={{ backgroundImage: "radial-gradient(circle at 30% 20%, var(--ds-accent-soft), var(--ds-surface) 75%)", boxShadow: "inset 0 1px 2px var(--ds-surface), var(--ds-elevation)" }}
      data-slot="theme-toggle"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      type="button"
    ><span data-theme-icon={theme === "dark" ? "sun" : "moon"}><ThemeIcon sun={theme === "dark"} /></span></button>
  </>;
}
