"use client";

import { RemoteAutocomplete } from "@technology-ecommerce/ui";
import { useEffect, useRef, useState } from "react";

import { useRemoteAutocomplete } from "../../hooks/use-remote-autocomplete";

export function InvoiceEntitySelector<T extends { id: string }>({
  label, value, scope, loadOptions, optionLabel, optionDescription, onSelect, onClear,
  disabled, error, inputRef, onBlur,
}: Readonly<{
  label: string; value?: string; scope: readonly string[];
  loadOptions: (search: string, signal: AbortSignal) => Promise<readonly T[]>;
  optionLabel: (option: T) => string; optionDescription: (option: T) => string;
  onSelect: (option: T) => void; onClear: () => void; disabled: boolean;
  error?: string; inputRef?: (element: HTMLInputElement | null) => void; onBlur: () => void;
}>) {
  const [selected, setSelected] = useState<T | null>(null);
  const [interacted, setInteracted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);
  const lookup = useRemoteAutocomplete({ scope, loadOptions, enabled: !disabled && !value });
  useEffect(() => {
    if (interacted) (selected?.id === value ? changeButton.current : input.current)?.focus();
  }, [interacted, selected?.id, value]);
  if (selected && selected.id === value) return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2">
        <div><p className="m-0 text-sm font-semibold text-slate-950">{optionLabel(selected)}</p><p className="m-0 text-xs text-slate-600">{optionDescription(selected)}</p></div>
        <button ref={changeButton} type="button" disabled={disabled} className="min-h-11 rounded-md px-3 text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-60" onClick={() => {
          setSelected(null); lookup.setSearch(""); onClear();
        }}>Cambiar {label.toLowerCase()}</button>
      </div>
    </div>
  );
  return <RemoteAutocomplete label={label} {...lookup} onRetry={lookup.retry} disabled={disabled}
    onSearchChange={lookup.setSearch} optionKey={(option) => option.id}
    optionLabel={optionLabel} optionDescription={optionDescription} inputRef={(element) => {
      input.current = element;
      inputRef?.(element);
    }}
    validationError={error} onBlur={onBlur} onSelect={(option) => {
      setInteracted(true); setSelected(option); onSelect(option); onBlur();
    }} />;
}
