import type { InputHTMLAttributes } from "react";

import { classNames } from "./class-names";

export type TextFieldProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
    className?: string;
    error?: string;
    hint?: string;
    id: string;
    label: string;
  }
>;

export function TextField({
  className,
  error,
  hint,
  id,
  label,
  ...inputProps
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [inputProps["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={classNames("grid gap-2", className)} data-slot="form-field">
      <label className="text-sm font-semibold text-slate-800" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <p className="m-0 text-sm text-slate-600" id={hintId}>
          {hint}
        </p>
      ) : null}
      <input
        {...inputProps}
        aria-describedby={describedBy}
        aria-invalid={error ? true : inputProps["aria-invalid"]}
        className={classNames(
          "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 shadow-sm outline-none",
          "placeholder:text-slate-500 focus:border-blue-700 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500",
          error && "border-red-700 focus:border-red-700 focus:ring-red-100",
        )}
        id={id}
      />
      {error ? (
        <p className="m-0 text-sm font-semibold text-red-700" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
