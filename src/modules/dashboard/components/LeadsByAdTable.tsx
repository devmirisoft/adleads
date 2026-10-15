'use client';

import { Megaphone } from 'lucide-react';
import { DataTable, EmptyState, type DataTableColumn } from '@/modules/core/components';
import type { AdRow } from '../services/reports';

const columns: DataTableColumn<AdRow>[] = [
  {
    id: 'ad',
    header: 'Ad',
    cell: ({ row }) => <span className="font-medium">{row.original.adName}</span>,
  },
  { id: 'leads', header: 'Leads', cell: ({ row }) => row.original.leads },
  { id: 'enrolled', header: 'Enrolled', cell: ({ row }) => row.original.enrolled },
  { id: 'conv', header: 'Conversion', cell: ({ row }) => `${row.original.conversionPct}%` },
];

export function LeadsByAdTable({ rows }: { rows: AdRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      total={rows.length}
      page={1}
      pageSize={Math.max(rows.length, 1)}
      emptyState={
        <EmptyState
          icon={Megaphone}
          title="No ad leads in this range"
          description="Pick a wider date range."
        />
      }
    />
  );
}
