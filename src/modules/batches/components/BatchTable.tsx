'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MoreHorizontal, Plus } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DateTime,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FilterBar,
  FilterSelect,
  StatusBadge,
  statusLabel,
  toast,
  type DataTableColumn,
} from '@/modules/core/components';
import { batchSchedule } from '../utils';
import { closeBatchAction } from '../services/actions';
import type { BatchListItem } from '../services/queries';
import { BatchFormDialog } from './BatchForm';
import { SeatMeter } from './SeatMeter';

type Course = { id: string; name: string };

/** ⋯ Edit / Close for one batch (ADMIN). Also used on the batch detail page header. */
export function BatchActions({ batch, courses }: { batch: BatchListItem; courses: Course[] }) {
  const [dialog, setDialog] = useState<'edit' | 'close' | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${batch.name}`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit batch</DropdownMenuItem>
          {batch.status !== 'CLOSED' && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('close')}>
              Close batch
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <BatchFormDialog
        open={dialog === 'edit'}
        onOpenChange={(o) => setDialog(o ? 'edit' : null)}
        courses={courses}
        batch={batch}
      />
      <ConfirmDialog
        open={dialog === 'close'}
        onOpenChange={(o) => setDialog(o ? 'close' : null)}
        tone="danger"
        title={`Close ${batch.course.name} — ${batch.name}?`}
        description={`No new trials will be booked into it. The ${batch.seatsTaken} current student(s) keep their seats and Zoom links.`}
        confirmLabel="Close batch"
        onConfirm={async () => {
          const res = await closeBatchAction(batch.id);
          if (res.ok) toast.success(`${batch.name} closed`);
          else toast.error(res.error);
        }}
      />
    </>
  );
}

/** "Add batch" button + dialog (ADMIN). */
export function AddBatchButton({ courses }: { courses: Course[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        Add batch
      </Button>
      <BatchFormDialog open={open} onOpenChange={setOpen} courses={courses} />
    </>
  );
}

type Props = {
  data: BatchListItem[];
  total: number;
  page: number;
  pageSize: number;
  courses: Course[];
  canEdit: boolean;
};

export function BatchTable({ data, total, page, pageSize, courses, canEdit }: Props) {
  const columns = useMemo<DataTableColumn<BatchListItem>[]>(() => {
    const cols: DataTableColumn<BatchListItem>[] = [
      {
        id: 'name',
        header: 'Batch',
        cell: ({ row: { original: b } }) => (
          <div className="flex flex-col">
            <span className="font-medium">{b.name}</span>
            <span className="text-xs text-muted-foreground">{b.course.name}</span>
          </div>
        ),
      },
      {
        id: 'schedule',
        header: 'Days / time (IST)',
        cell: ({ row }) => batchSchedule(row.original),
      },
      {
        id: 'dates',
        header: 'Runs',
        cell: ({ row: { original: b } }) => (
          <span>
            <DateTime value={b.startDate} dateOnly /> – <DateTime value={b.endDate} dateOnly />
          </span>
        ),
      },
      {
        id: 'seats',
        header: 'Seats',
        cell: ({ row: { original: b } }) => (
          <SeatMeter taken={b.seatsTaken} capacity={b.capacity} />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ];
    if (canEdit) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <BatchActions batch={row.original} courses={courses} />,
      });
    }
    return cols;
  }, [canEdit, courses]);

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onRowHref={(b) => `/batches/${b.id}`}
      emptyState={
        <EmptyState
          icon={CalendarDays}
          title="No batches here"
          description={
            canEdit
              ? 'Add a batch to start taking trial bookings.'
              : 'Clear the filters to see all batches.'
          }
          action={
            canEdit ? (
              <Button variant="outline" asChild>
                <Link href="/batches">Show all batches</Link>
              </Button>
            ) : undefined
          }
        />
      }
    />
  );
}

/** search → status → course. */
export function BatchFilterBar({ courses }: { courses: Course[] }) {
  return (
    <FilterBar searchPlaceholder="Batch name">
      <FilterSelect
        param="status"
        label="Status"
        options={(['OPEN', 'FULL', 'CLOSED'] as const).map((s) => ({
          value: s,
          label: statusLabel(s),
        }))}
      />
      <FilterSelect
        param="courseId"
        label="Course"
        options={courses.map((c) => ({ value: c.id, label: c.name }))}
      />
    </FilterBar>
  );
}
