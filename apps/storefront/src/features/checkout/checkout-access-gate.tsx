"use client";

import { LoadingState } from "@technology-ecommerce/ui";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSessionStore } from "../auth/session";

export function CheckoutAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useSessionStore((state) => state.session);
  const status = useSessionStore((state) => state.status);
  const isCustomer = session?.user.role === "CUSTOMER";

  useEffect(() => {
    if (status === "anonymous" || (status === "authenticated" && !isCustomer)) {
      router.replace("/login?returnTo=%2Fcheckout");
    }
  }, [isCustomer, router, status]);

  if (status === "initializing" || !isCustomer) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-14 lg:px-10">
        <LoadingState message="Validando acceso al checkout…" />
      </main>
    );
  }

  return <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-950"><div className="mx-auto max-w-6xl">{children}</div></main>;
}
