"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";

export type RemoteAutocompleteProps<T> = Readonly<{
  label: string;
  search: string;
  onSearchChange: (search: string) => void;
  options: readonly T[];
  optionKey: (option: T) => string;
  optionLabel: (option: T) => string;
  optionDescription?: (option: T) => string;
  onSelect: (option: T) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  disabled?: boolean;
  minLength?: number;
  validationError?: string;
  onBlur?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}>;

export function RemoteAutocomplete<T>({
  label, search, onSearchChange, options, optionKey, optionLabel,
  optionDescription, onSelect, loading = false, error = false,
  onRetry, disabled = false, minLength = 3, validationError, onBlur, inputRef,
}: RemoteAutocompleteProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const eligible = search.trim().length >= minLength;
  const results = eligible && !loading && !error && !disabled ? options : [];
  const expanded = open && !disabled;
  const activeIndex = results.findIndex((option) => optionKey(option) === activeKey);
  const activeId = expanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined;
  const status = !eligible ? `Escribe al menos ${minLength} caracteres para buscar.`
    : loading ? "Buscando…"
      : error ? "No se pudo realizar la búsqueda. Intenta nuevamente."
        : results.length ? `${results.length} resultados. Usa las flechas y Enter para seleccionar.`
          : "No hay coincidencias. Prueba con otro nombre.";

  useEffect(() => {
    if (activeId) activeRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function select(option: T) {
    setOpen(false);
    setActiveKey(null);
    onSelect(option);
  }

  function navigate(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      if (expanded) event.preventDefault();
      setOpen(false);
      setActiveKey(null);
      return;
    }
    if (event.key === "Enter" && expanded && activeIndex >= 0) {
      event.preventDefault();
      select(results[activeIndex]!);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || (expanded && ["Home", "End"].includes(event.key))) {
      event.preventDefault();
      setOpen(true);
      if (!results.length) return;
      const index = event.key === "Home" ? 0 : event.key === "End" ? results.length - 1
        : event.key === "ArrowDown" ? (activeIndex + 1) % results.length
          : (activeIndex < 0 ? results.length - 1 : (activeIndex - 1 + results.length) % results.length);
      setActiveKey(optionKey(results[index]!));
    }
  }

  return (
    <div className="relative grid gap-2" data-slot="remote-autocomplete" onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setOpen(false);
        setActiveKey(null);
        onBlur?.();
      }
    }}>
      <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
      <input ref={inputRef} id={id} role="combobox" type="text" autoComplete="off" maxLength={200}
        value={search} disabled={disabled} aria-autocomplete="list"
        aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
        aria-activedescendant={activeId} aria-describedby={`${id}-status${validationError ? ` ${id}-error` : ""}`}
        aria-invalid={!!validationError} onKeyDown={navigate}
        onFocus={() => setOpen(true)} onChange={(event) => {
          setOpen(true);
          setActiveKey(null);
          onSearchChange(event.target.value);
        }}
        className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <p id={`${id}-status`} role="status" aria-live="polite" aria-atomic="true" className="m-0 text-sm text-slate-600">{status}</p>
      {validationError ? <p id={`${id}-error`} role="alert" className="m-0 text-sm font-semibold text-red-700">{validationError}</p> : null}
      {expanded ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-slate-300 bg-white shadow-lg">
          <ul id={`${id}-list`} role="listbox" aria-label={label} aria-busy={loading}
            className="m-0 max-h-64 list-none overflow-y-auto p-1">
            {results.map((option, index) => (
              <li key={optionKey(option)} id={`${id}-option-${index}`} role="option"
                aria-selected={index === activeIndex} ref={index === activeIndex ? activeRef : undefined}
                onMouseDown={(event) => event.preventDefault()} onClick={() => select(option)}
                className={`cursor-pointer rounded-md border-l-2 px-3 py-2 ${index === activeIndex ? "border-blue-700 bg-blue-50 text-slate-950" : "border-transparent text-slate-800 hover:bg-[var(--admin-surface-subtle,#f8fafc)]"}`}>
                <span className="block text-sm font-semibold">{optionLabel(option)}</span>
                {optionDescription ? <span className="block text-xs text-slate-600">{optionDescription(option)}</span> : null}
              </li>
            ))}
          </ul>
          {!results.length ? <p className="m-0 px-4 py-3 text-sm text-slate-600">{status}</p> : null}
          {error && onRetry ? <button type="button" onClick={onRetry} className="m-2 rounded-md px-3 py-2 text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700">Reintentar búsqueda</button> : null}
        </div>
      ) : null}
    </div>
  );
}
