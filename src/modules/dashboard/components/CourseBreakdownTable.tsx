'use client';

import { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import { DataTable, EmptyState, Money, type DataTableColumn } from '@/modules/core/components';
import type { CourseRow } from '../services/reports';

/** A column of lead counts: the statuses it adds up (from the leads module, passed in by the page). */
export type StageColumn = { key: string; label: string; statuses: readonly string[] };

const count = (row: CourseRow, statuses: readonly string[]) =>
  statuses.reduce((n, s) => n + (row.byStatus[s] ?? 0), 0);

export function CourseBreakdownTable({
  rows,
  stages,
}: {
  rows: CourseRow[];
  stages: StageColumn[];
}) {
  const columns = useMemo<DataTableColumn<CourseRow>[]>(
    () => [
      {
        id: 'course',
        header: 'Course',
        cell: ({ row }) => <span className="font-medium">{row.original.course}</span>,
      },
      { id: 'leads', header: 'Leads', cell: ({ row }) => row.original.leads },
      ...stages.map((s): DataTableColumn<CourseRow> => ({
        id: s.key,
        header: s.label,
        cell: ({ row }) => count(row.original, s.statuses),
      })),
      {
        id: 'revenue',
        header: 'Payments received',
        cell: ({ row }) => <Money paise={row.original.revenuePaise} />,
      },
    ],
    [stages],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      total={rows.length}
      page={1}
      pageSize={Math.max(rows.length, 1)}
      emptyState={
        <EmptyState
          icon={BookOpen}
          title="No leads or payments in this range"
          description="Pick a wider date range."
        />
      }
    />
  );
}
