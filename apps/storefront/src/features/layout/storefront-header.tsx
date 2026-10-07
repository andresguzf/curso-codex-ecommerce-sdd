"use client";

import { useEffect, useState, type ReactNode } from "react";

export function StorefrontHeader({ children }: Readonly<{ children: ReactNode }>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return <header data-slot="storefront-header" data-scrolled={scrolled} className="sticky top-0 z-40 border-b border-[var(--ds-border-subtle)] text-[var(--ds-text)] backdrop-blur-xl">{children}</header>;
}
