import { useId } from "react";

/** Color and depth without raster assets, while retaining sharp edges at any size. */
export function ThemeIcon({ sun }: Readonly<{ sun: boolean }>) {
  const gradient = useId();
  return <svg aria-hidden="true" focusable="false" className="size-6" viewBox="0 0 24 24" fill="none">
    <defs><linearGradient id={gradient} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
      <stop stopColor={sun ? "#fef08a" : "#bae6fd"} /><stop offset="1" stopColor={sun ? "#f59e0b" : "#818cf8"} />
    </linearGradient></defs>
    {sun ? <>
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="var(--ds-warning)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4.5" fill={`url(#${gradient})`} stroke="var(--ds-warning)" strokeWidth="1.5" />
      <path d="M9.5 11a3 3 0 0 1 2-2" stroke="#fff7ed" strokeWidth="1.5" strokeLinecap="round" />
    </> : <>
      <path d="M17 15.5A8.3 8.3 0 0 1 9 4a8.5 8.5 0 1 0 11 11 8 8 0 0 1-3 .5Z" fill={`url(#${gradient})`} stroke="var(--ds-accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m17 3 .65 1.85L19.5 5.5l-1.85.65L17 8l-.65-1.85L14.5 5.5l1.85-.65Z" fill="#fbbf24" stroke="var(--ds-warning)" strokeWidth=".6" />
      <circle cx="21" cy="10" r="1" fill="#fbbf24" />
    </>}
  </svg>;
}
