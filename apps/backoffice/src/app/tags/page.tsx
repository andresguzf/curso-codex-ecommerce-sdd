import { LoadingState } from "@technology-ecommerce/ui";
import { Suspense } from "react";

import { ClassificationManagement } from "@/features/classifications/classification-management";

export default function TagsPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoadingState message="Preparando etiquetas…" /></main>}><ClassificationManagement kind="tags" /></Suspense>;
}
