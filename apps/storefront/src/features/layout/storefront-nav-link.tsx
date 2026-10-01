"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export function StorefrontNavLink({ href, descendants = false, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string; descendants?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (descendants && pathname?.startsWith(`${href}/`));
  return <Link {...props} href={href} data-slot="storefront-nav-link" aria-current={active ? "page" : undefined} />;
}
