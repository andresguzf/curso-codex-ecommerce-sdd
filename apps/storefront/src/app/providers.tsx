"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlashRegion, ThemeProvider } from "@technology-ecommerce/ui";
import { useState, type ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session-provider";

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
      <ThemeProvider application="storefront">
        <SessionProvider>
          {children}
          <FlashRegion appearance="storefront" />
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
