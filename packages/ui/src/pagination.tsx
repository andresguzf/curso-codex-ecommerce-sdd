import { classNames } from "./class-names";

type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

export function getPaginationItems(
  page: number,
  totalPages: number,
): PaginationItem[] {
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(totalPages) ||
    totalPages < 1 ||
    page < 1 ||
    page > totalPages
  ) {
    throw new RangeError(
      "Pagination requires a valid current page and total page count",
    );
  }

  const visiblePages = new Set<number>([1, totalPages]);
  const firstSibling = Math.max(1, page - 4);
  const lastSibling = Math.min(totalPages, page + 4);

  for (let candidate = firstSibling; candidate <= lastSibling; candidate += 1) {
    visiblePages.add(candidate);
  }

  const sortedPages = [...visiblePages].sort((left, right) => left - right);
  const items: PaginationItem[] = [];

  sortedPages.forEach((visiblePage, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage !== undefined && visiblePage - previousPage > 1) {
      if (visiblePage - previousPage === 2) {
        items.push(previousPage + 1);
      } else {
        items.push(previousPage === 1 ? "ellipsis-left" : "ellipsis-right");
      }
    }
    items.push(visiblePage);
  });

  return items;
}

export function Pagination({
  ariaLabel = "Paginación",
  className,
  onPageChange,
  page,
  totalPages,
}: Readonly<{
  ariaLabel?: string;
  className?: string;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}>) {
  const items = getPaginationItems(page, totalPages);
  const atFirstPage = page === 1;
  const atLastPage = page === totalPages;
  const buttonClassName = "min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
  const pageButtonClassName = "min-h-10 min-w-10 rounded-lg border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

  return (
    <nav aria-label={ariaLabel} className={classNames("grid gap-3", className)} data-slot="pagination">
      <p className="m-0 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Página {page} de {totalPages}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button aria-label="Ir a la primera página" className={buttonClassName} disabled={atFirstPage} onClick={() => onPageChange(1)} type="button">
          Primera
        </button>
        <button aria-label="Ir a la página anterior" className={buttonClassName} disabled={atFirstPage} onClick={() => onPageChange(page - 1)} type="button">
          Anterior
        </button>

        <ol className="flex list-none flex-wrap items-center justify-center gap-1 p-0" aria-label="Páginas disponibles">
          {items.map((item) => (
            <li key={item}>
              {typeof item === "number" ? (
                <button
                  aria-current={item === page ? "page" : undefined}
                  aria-label={item === page ? `Página ${item}, actual` : `Ir a la página ${item}`}
                  className={classNames(
                    pageButtonClassName,
                    item === page
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800",
                  )}
                  disabled={item === page}
                  onClick={() => onPageChange(item)}
                  type="button"
                >
                  {item}
                </button>
              ) : (
                <span aria-hidden="true" className="grid min-h-10 min-w-8 place-items-center text-slate-400">
                  …
                </span>
              )}
            </li>
          ))}
        </ol>

        <button aria-label="Ir a la página siguiente" className={buttonClassName} disabled={atLastPage} onClick={() => onPageChange(page + 1)} type="button">
          Siguiente
        </button>
        <button aria-label="Ir a la última página" className={buttonClassName} disabled={atLastPage} onClick={() => onPageChange(totalPages)} type="button">
          Última
        </button>
      </div>
    </nav>
  );
}
