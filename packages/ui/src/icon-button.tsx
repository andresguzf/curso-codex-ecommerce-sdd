import type { ReactElement } from "react";

import { classNames } from "./class-names";

export type IconName =
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "edit"
  | "eye"
  | "file-invoice"
  | "plus"
  | "power"
  | "trash"
  | "x";

export function Icon({ name }: Readonly<{ name: IconName }>) {
  const common = {
    "aria-hidden": true,
    className: "size-5",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
    viewBox: "0 0 24 24",
  };

  const paths: Record<IconName, ReactElement> = {
    check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
    "chevron-left": <path d="m15 18-6-6 6-6" />,
    "chevron-right": <path d="m9 18 6-6-6-6" />,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    "file-invoice": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    power: <><path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" /></>,
    trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m6 7 1 14h10l1-14M9 7V4h6v3" /></>,
    x: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

/** Icon-only action button with an accessible name and native tooltip. */
export function IconButton({
  ariaExpanded,
  busy,
  className,
  disabled,
  icon,
  label,
  onClick,
  type = "button",
}: Readonly<{
  ariaExpanded?: boolean;
  busy?: boolean;
  className?: string;
  disabled?: boolean;
  icon: IconName;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
}>) {
  return (
    <button
      aria-label={label}
      aria-busy={busy}
      aria-expanded={ariaExpanded}
      className={classNames(
        "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type={type}
    >
      <Icon name={icon} />
    </button>
  );
}
