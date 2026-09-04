import type { ReactNode } from "react";

import { classNames } from "./class-names";

export type DataTableColumn<Row> = Readonly<{
  cell: (row: Row) => ReactNode;
  header: ReactNode;
  id: string;
}>;

export function DataTable<Row>({
  caption,
  className,
  columns,
  emptyMessage = "No hay resultados para mostrar.",
  rowKey,
  rows,
}: Readonly<{
  caption: string;
  className?: string;
  columns: readonly DataTableColumn<Row>[];
  emptyMessage?: string;
  rowKey: (row: Row) => string;
  rows: readonly Row[];
}>) {
  return (
    <div className={classNames("overflow-x-auto rounded-xl border border-slate-200", className)} data-slot="data-table">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-bold" key={column.id} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white text-slate-900">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-8 text-center text-slate-600" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="hover:bg-slate-50" key={rowKey(row)}>
                {columns.map((column) => (
                  <td className="px-4 py-3" key={column.id}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
