import type { CartActionFeedback as CartActionFeedbackModel } from "./use-add-to-cart";

export function CartActionFeedback({
  feedback,
}: Readonly<{ feedback: CartActionFeedbackModel | null }>) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={feedback
        ? feedback.kind === "success"
          ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900"
          : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
        : "sr-only"}
      role={feedback?.kind === "error" ? "alert" : "status"}
    >
      {feedback?.message}
    </div>
  );
}
