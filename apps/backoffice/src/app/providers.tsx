"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlashRegion, ThemeProvider } from "@technology-ecommerce/ui";
import { useState, type ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session-provider";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider application="backoffice">
        <SessionProvider>{children}</SessionProvider>
        <FlashRegion appearance="backoffice" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
