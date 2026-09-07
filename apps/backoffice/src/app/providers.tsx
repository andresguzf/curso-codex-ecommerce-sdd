"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { SessionProvider } from "@/features/auth/session-provider";
import { AdminThemeController } from "@/features/theme/admin-theme-controller";

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
      <AdminThemeController />
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
