"use client";

import { Pagination } from "@technology-ecommerce/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function BackofficePagination({
  page,
  totalPages,
}: Readonly<{
  page: number;
  totalPages: number;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handlePageChange(nextPage: number) {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("page", String(nextPage));
    router.push(`${pathname}?${nextParams.toString()}`, { scroll: false });
  }

  return (
    <Pagination
      ariaLabel="Paginación del listado administrativo"
      className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4"
      onPageChange={handlePageChange}
      page={page}
      totalPages={totalPages}
    />
  );
}
