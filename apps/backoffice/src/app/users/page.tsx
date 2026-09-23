import { Suspense } from "react";
import { LoadingState } from "@technology-ecommerce/ui";

import { UserManagement } from "@/features/users/user-management";

export default function UsersPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center"><LoadingState message="Preparando usuarios…" /></main>}><UserManagement /></Suspense>;
}
