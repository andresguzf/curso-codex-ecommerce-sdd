import type { ReactNode } from "react";

import { classNames } from "./class-names";

export type NavigationItem = Readonly<{
  badge?: ReactNode;
  badgeLabel?: string;
  current?: boolean;
  href: string;
  label: string;
}>;

export function Navigation({
  ariaLabel,
  className,
  items,
}: Readonly<{
  ariaLabel: string;
  className?: string;
  items: readonly NavigationItem[];
}>) {
  return (
    <nav aria-label={ariaLabel} className={className} data-slot="navigation">
      <ul className="flex list-none flex-wrap items-center gap-1 p-0" role="list">
        {items.map((item) => (
          <li key={`${item.href}-${item.label}`}>
            <a
              aria-current={item.current ? "page" : undefined}
              className={classNames(
                "inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 no-underline transition-colors",
                "hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                item.current && "bg-slate-100 text-slate-950",
              )}
              href={item.href}
            >
              {item.label}
              {item.badge !== undefined ? (
                <span
                  aria-label={item.badgeLabel}
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-700 px-1.5 py-0.5 text-xs font-bold text-white"
                  data-slot="navigation-badge"
                >
                  {item.badge}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
