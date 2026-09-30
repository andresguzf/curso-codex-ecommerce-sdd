"use client";

import type { Tag } from "@technology-ecommerce/api-schemas";

type TagChoice = Pick<Tag, "id" | "name" | "status">;

export function ProductTagEditor({
  availableTags,
  currentTags,
  draft,
  error,
  newNames,
  onCommit,
  onDraftChange,
  onRemoveId,
  onRemoveName,
  onSelectId,
  selectedIds,
}: Readonly<{
  availableTags: readonly TagChoice[];
  currentTags: readonly TagChoice[];
  draft: string;
  error?: string;
  newNames: readonly string[];
  onCommit: (value: string) => boolean;
  onDraftChange: (value: string) => void;
  onRemoveId: (id: string) => void;
  onRemoveName: (name: string) => void;
  onSelectId: (id: string) => void;
  selectedIds: readonly string[];
}>) {
  const knownTags = new Map([...availableTags, ...currentTags].map((tag) => [tag.id, tag]));
  const unselectedTags = availableTags.filter((tag) => !selectedIds.includes(tag.id));

  return (
    <fieldset className="grid min-w-0 content-start gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <legend className="px-1 text-sm font-semibold text-slate-800">Etiquetas</legend>
      <div aria-live="polite" className="flex min-h-8 flex-wrap gap-2">
        {selectedIds.map((id) => {
          const tag = knownTags.get(id);
          if (!tag) return null;
          return <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white py-1 pl-3 pr-1 text-xs font-semibold text-slate-800" key={id}>
            {tag.name}{tag.status === "INACTIVE" ? " (inactiva)" : ""}
            <button aria-label={`Quitar etiqueta ${tag.name}`} className="inline-flex size-6 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" onClick={() => onRemoveId(id)} type="button">×</button>
          </span>;
        })}
        {newNames.map((name) => <span className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 py-1 pl-3 pr-1 text-xs font-semibold text-blue-900" key={name.toUpperCase()}>
          {name}<span className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Nueva</span>
          <button aria-label={`Quitar etiqueta ${name}`} className="inline-flex size-6 items-center justify-center rounded-full text-blue-800 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" onClick={() => onRemoveName(name)} type="button">×</button>
        </span>)}
        {!selectedIds.length && !newNames.length ? <span className="self-center text-xs text-slate-500">Sin etiquetas asignadas</span> : null}
      </div>
      <label className="text-xs font-semibold text-slate-700" htmlFor="product-tag-entry">Agregar etiquetas por nombre</label>
      <input
        aria-describedby="product-tag-help"
        aria-invalid={Boolean(error)}
        className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-200 aria-invalid:border-red-700"
        id="product-tag-entry"
        onBlur={() => { if (draft.trim()) onCommit(draft); }}
        onChange={(event) => {
          const value = event.target.value;
          if (!value.includes(",")) { onDraftChange(value); return; }
          const parts = value.split(",");
          if (onCommit(parts.slice(0, -1).join(","))) onDraftChange(parts.at(-1) ?? "");
          else onDraftChange(value);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== ",") return;
          event.preventDefault();
          if (draft.trim()) onCommit(draft);
        }}
        placeholder="Ej.: RGB, mecánico, inalámbrico"
        type="text"
        value={draft}
      />
      <p className="m-0 text-xs text-slate-600" id="product-tag-help">Escribe un nombre y pulsa Enter o coma. Si ya existe, se reutilizará.</p>
      {error ? <p className="m-0 text-xs font-semibold text-red-700" role="alert">{error}</p> : null}
      {unselectedTags.length ? <details className="text-xs text-slate-700">
        <summary className="cursor-pointer font-semibold text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">Elegir etiquetas existentes</summary>
        <div className="mt-2 flex max-h-36 flex-wrap gap-2 overflow-auto">
          {unselectedTags.map((tag) => <button className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-600 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700" key={tag.id} onClick={() => onSelectId(tag.id)} type="button">+ {tag.name}</button>)}
        </div>
      </details> : null}
    </fieldset>
  );
}
