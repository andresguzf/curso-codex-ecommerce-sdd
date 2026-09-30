"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export type RemoteAutocompleteConfig<T> = Readonly<{
  /** Include resource and account ID; never include credentials in a cache key. */
  scope: readonly string[];
  loadOptions: (search: string, signal: AbortSignal) => Promise<readonly T[]>;
  enabled?: boolean;
  debounceMs?: number;
}>;

/** REST loaders must validate their bounded response at the API boundary. */
export function useRemoteAutocomplete<T>({
  scope, loadOptions, enabled = true, debounceMs = 250,
}: RemoteAutocompleteConfig<T>) {
  const [search, setSearch] = useState("");
  const term = search.trim();
  const [settledTerm, setSettledTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSettledTerm(term), debounceMs);
    return () => clearTimeout(timer);
  }, [term, debounceMs]);

  const eligible = enabled && scope.length > 0 && term.length >= 3;
  const ready = eligible && term === settledTerm;
  const query = useQuery({
    // Switch keys immediately to detach/abort obsolete requests while waiting.
    queryKey: ["remote-autocomplete", ...scope, term, enabled],
    queryFn: ({ signal }) => loadOptions(term, signal),
    enabled: ready,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    search,
    setSearch,
    minLength: 3,
    options: ready && !query.isError ? query.data ?? [] : [],
    loading: eligible && (!ready || query.isFetching),
    error: ready && query.isError,
    retry: () => { if (ready) void query.refetch(); },
  };
}
