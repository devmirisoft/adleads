'use client';

import { useRouter } from 'next/navigation';
import { tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useQueryState } from '../hooks/useQueryState';

// Core features only: sorting/filtering/pagination happen on the server via URL params.
const features = tableFeatures({});

/** Column definition for DataTable: `{ accessorKey, header, cell }`. */
export type DataTableColumn<T extends RowData> = ColumnDef<typeof features, T>;

type Props<T extends RowData> = {
  /** Keep at module scope (or memoised) — a new array every render rebuilds the row model. */
  columns: DataTableColumn<T>[];
  data: T[];
  /** Total rows across all pages (server-side pagination). */
  total: number;
  /** 1-based, read from the `page` URL param by the page. */
  page: number;
  pageSize: number;
  /** Row click opens this href. Clicks on buttons, links and menu items inside the row are ignored. */
  onRowHref?: (row: T) => string;
  emptyState: React.ReactNode;
  isLoading?: boolean;
  /** Adds a checkbox column for bulk actions on the current page. */
  selection?: {
    getId: (row: T) => string;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  };
};

const INTERACTIVE = 'a,button,input,select,textarea,[role=menuitem],[role=dialog],[role=checkbox]';

/** Server-paginated table. Render inside <Suspense> (pagination uses URL params). */
export function DataTable<T extends RowData>({
  columns,
  data,
  total,
  page,
  pageSize,
  onRowHref,
  emptyState,
  isLoading = false,
  selection,
}: Props<T>) {
  const router = useRouter();
  const [, setPage] = useQueryState('page');
  const table = useTable({ features, columns, data });

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const colSpan = columns.length + (selection ? 1 : 0);
  const pageIds = selection ? data.map(selection.getId) : [];
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selection?.selectedIds.includes(id));
  const toggle = (id: string, on: boolean) =>
    selection?.onChange(
      on ? [...selection.selectedIds, id] : selection.selectedIds.filter((x) => x !== id),
    );

  function open(e: React.SyntheticEvent, row: T) {
    if (!onRowHref || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    router.push(onRowHref(row));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {selection && (
                  <TableHead className="w-8">
                    <Checkbox
                      aria-label="Select all rows on this page"
                      checked={allSelected}
                      onCheckedChange={(on) => selection.onChange(on === true ? pageIds : [])}
                    />
                  </TableHead>
                )}
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan}>{emptyState}</TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={onRowHref ? 'cursor-pointer' : undefined}
                  tabIndex={onRowHref ? 0 : undefined}
                  onClick={(e) => open(e, row.original)}
                  onKeyDown={(e) => e.key === 'Enter' && open(e, row.original)}
                >
                  {selection && (
                    <TableCell>
                      <Checkbox
                        aria-label="Select row"
                        checked={selection.selectedIds.includes(selection.getId(row.original))}
                        onCheckedChange={(on) => toggle(selection.getId(row.original), on === true)}
                      />
                    </TableCell>
                  )}
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Showing {from}–{to} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1 > 1 ? String(page - 1) : null)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => setPage(String(page + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
