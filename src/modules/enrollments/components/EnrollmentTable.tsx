'use client';

import { useMemo } from 'react';
import { GraduationCap } from 'lucide-react';
import {
  DataTable,
  DateTime,
  EmptyState,
  FilterBar,
  FilterSelect,
  Phone,
  StatusBadge,
  statusLabel,
  type DataTableColumn,
} from '@/modules/core/components';
import type { ApiResult } from '@/modules/core/types';
import type { EnrollmentListItem } from '../services/queries';
import type { BatchOption } from '../types';
import { EnrollmentActions } from './EnrollmentActions';

const name = (l: EnrollmentListItem['lead']) => l.name ?? l.profileName ?? 'Unnamed lead';
const DAY = 86_400_000;

type Props = {
  data: EnrollmentListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** IST date "yyyy-MM-dd" from the server (respects the dev clock). */
  today: string;
  batches: BatchOption[];
  canAct: boolean;
  requestPayment?: (enrollmentId: string) => Promise<ApiResult<unknown>>;
  emptyHint?: string;
};

/** Enrollments list (also used for a batch's students). Rows open the lead. */
export function EnrollmentTable({
  data,
  total,
  page,
  pageSize,
  today,
  batches,
  canAct,
  requestPayment,
  emptyHint,
}: Props) {
  const columns = useMemo<DataTableColumn<EnrollmentListItem>[]>(() => {
    const cols: DataTableColumn<EnrollmentListItem>[] = [
      {
        id: 'student',
        header: 'Student',
        cell: ({ row: { original: e } }) => (
          <div className="flex flex-col items-start">
            <span className="font-medium">{name(e.lead)}</span>
            <Phone e164={e.lead.phoneE164} />
          </div>
        ),
      },
      {
        id: 'batch',
        header: 'Batch',
        cell: ({ row: { original: e } }) => (
          <div className="flex flex-col">
            <span>{e.batch.name}</span>
            <span className="text-xs text-muted-foreground">{e.batch.course.name}</span>
          </div>
        ),
      },
      {
        id: 'trial',
        header: 'Trial',
        cell: ({ row: { original: e } }) => (
          <span>
            <DateTime value={e.trialStart} dateOnly /> – <DateTime value={e.trialEnd} dateOnly />
          </span>
        ),
      },
      {
        id: 'left',
        header: 'Days left',
        cell: ({ row: { original: e } }) => {
          if (e.status !== 'TRIAL') return '—';
          const left = Math.round(
            (new Date(e.trialEnd).getTime() - new Date(today).getTime()) / DAY,
          );
          return left < 0 ? 'Ended' : left === 0 ? 'Last day' : left;
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: 'paid',
        header: 'Paid on',
        cell: ({ row }) => (row.original.paidAt ? <DateTime value={row.original.paidAt} /> : '—'),
      },
    ];
    if (canAct) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row: { original: e } }) => (
          <EnrollmentActions
            enrollment={{ id: e.id, status: e.status, leadName: name(e.lead), batch: e.batch }}
            batches={batches}
            requestPayment={requestPayment}
          />
        ),
      });
    }
    return cols;
  }, [canAct, batches, requestPayment, today]);

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onRowHref={(e) => `/leads/${e.lead.id}`}
      emptyState={
        <EmptyState
          icon={GraduationCap}
          title="No enrollments here"
          description={emptyHint ?? 'Clear the search or pick other filters.'}
        />
      }
    />
  );
}

/** search → status → batch → trial ending soon. */
export function EnrollmentFilterBar({ batches }: { batches: { id: string; name: string }[] }) {
  return (
    <FilterBar>
      <FilterSelect
        param="status"
        label="Status"
        options={(['TRIAL', 'PAID', 'EXPIRED', 'CANCELLED'] as const).map((s) => ({
          value: s,
          label: statusLabel(s),
        }))}
      />
      <FilterSelect
        param="batchId"
        label="Batch"
        options={batches.map((b) => ({ value: b.id, label: b.name }))}
      />
      <FilterSelect
        param="endingInDays"
        label="Trial ending"
        allLabel="Any time"
        options={[
          { value: '0', label: 'Today' },
          { value: '1', label: 'Within 1 day' },
          { value: '2', label: 'Within 2 days' },
          { value: '3', label: 'Within 3 days' },
          { value: '7', label: 'Within 7 days' },
        ]}
      />
    </FilterBar>
  );
}
