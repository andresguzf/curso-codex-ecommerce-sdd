"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session-provider";
import { CartShortcut } from "@/features/cart/cart-shortcut";
import { SessionControls } from "@/features/auth/session-controls";

export function StorefrontProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <header className="border-b border-slate-200 bg-white px-4 py-3 text-slate-950 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <SessionControls />
            <CartShortcut />
          </div>
        </header>
        {children}
      </SessionProvider>
    </QueryClientProvider>
  );
}
