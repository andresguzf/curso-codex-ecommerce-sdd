import type { FieldError, UseFormRegisterReturn } from "react-hook-form";

export function AuthField({
  autoComplete,
  error,
  label,
  registration,
  type = "text",
}: Readonly<{
  autoComplete: string;
  error?: FieldError;
  label: string;
  registration: UseFormRegisterReturn;
  type?: "email" | "password" | "text";
}>) {
  const errorId = `${registration.name}-error`;
  return (
    <div>
      <label htmlFor={registration.name} className="mb-2 block text-sm font-bold text-slate-800">{label}</label>
      <input
        {...registration}
        id={registration.name}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-base outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 aria-invalid:border-red-600"
      />
      {error ? <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-red-700">{error.message}</p> : null}
    </div>
  );
}
