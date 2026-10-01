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

  return <header data-slot="storefront-header" data-scrolled={scrolled} data-tone-region="inverse" className="sticky top-0 z-40 border-b border-blue-300/20 text-white shadow-lg shadow-blue-950/45 backdrop-blur-xl">{children}</header>;
}
