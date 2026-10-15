'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Users } from 'lucide-react';
import {
  Button,
  DataTable,
  DateTime,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Phone,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatusBadge,
  toast,
  type DataTableColumn,
} from '@/modules/core/components';
import { SOURCE_LABEL } from '../constants/statuses';
import { leadName } from '../utils';
import type { LeadListItem } from '../services/queries';
import { assignLeads, resolveLead } from '../services/actions';

type Staff = { id: string; name: string };
type Props = {
  data: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  staff: Staff[];
  /** SALES/ADMIN: bulk assign + row actions. VIEWER: read-only. */
  canAct: boolean;
  currentUserId: string;
};

const preview = (body: unknown) =>
  body && typeof body === 'object' && 'text' in body ? String(body.text ?? '') : '';

function columns(canAct: boolean, me: string): DataTableColumn<LeadListItem>[] {
  return [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row: { original: l } }) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-medium">{leadName(l)}</span>
          {l.needsHuman && <StatusBadge status="NEEDS_HUMAN" />}
        </div>
      ),
    },
    { id: 'phone', header: 'Phone', cell: ({ row }) => <Phone e164={row.original.phoneE164} /> },
    { id: 'course', header: 'Course', cell: ({ row }) => row.original.course?.name ?? '—' },
    {
      id: 'batch',
      header: 'Batch',
      cell: ({ row }) => row.original.enrollments[0]?.batch.name ?? '—',
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'source',
      header: 'Source',
      cell: ({ row: { original: l } }) => (
        <div className="flex flex-col">
          <span>{SOURCE_LABEL[l.source]}</span>
          {l.adName && <span className="text-xs text-muted-foreground">{l.adName}</span>}
        </div>
      ),
    },
    {
      id: 'last',
      header: 'Last message',
      cell: ({ row }) => {
        const m = row.original.messages[0];
        if (!m) return '—';
        return (
          <div className="flex max-w-xs flex-col">
            <span className="truncate">{preview(m.body) || 'Template / media'}</span>
            <span className="text-xs text-muted-foreground">
              <DateTime value={m.createdAt} />
            </span>
          </div>
        );
      },
    },
    {
      id: 'assigned',
      header: 'Assigned to',
      cell: ({ row }) => row.original.assignedTo?.name ?? '—',
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <RowActions lead={row.original} canAct={canAct} me={me} />,
    },
  ];
}

function RowActions({ lead, canAct, me }: { lead: LeadListItem; canAct: boolean; me: string }) {
  const run = async (p: Promise<{ ok: boolean; error?: string }>, success: string) => {
    const res = await p;
    if (res.ok) toast.success(success);
    else toast.error(res.error);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${leadName(lead)}`}>
          <MoreHorizontal className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/leads/${lead.id}`}>Open</Link>
        </DropdownMenuItem>
        {canAct && lead.assignedTo?.id !== me && (
          <DropdownMenuItem
            onSelect={() => run(assignLeads([lead.id], me), `${leadName(lead)} assigned to you`)}
          >
            Assign to me
          </DropdownMenuItem>
        )}
        {canAct && lead.needsHuman && (
          <DropdownMenuItem onSelect={() => run(resolveLead(lead.id), 'Marked resolved')}>
            Mark resolved
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const UNASSIGN = '__none';

export function LeadsTable({ data, total, page, pageSize, staff, canAct, currentUserId }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [assignee, setAssignee] = useState('');
  const [pending, start] = useTransition();
  const cols = useMemo(() => columns(canAct, currentUserId), [canAct, currentUserId]);

  const assign = () =>
    start(async () => {
      const res = await assignLeads(selected, assignee === UNASSIGN ? null : assignee);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${res.data} lead${res.data === 1 ? '' : 's'} updated`);
      setSelected([]);
    });

  return (
    <div className="flex flex-col gap-3">
      {canAct && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
          <span className="text-sm">{selected.length} selected</span>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-48" aria-label="Assign to">
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
              <SelectItem value={UNASSIGN}>Nobody (unassign)</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={!assignee || pending} onClick={assign}>
            Assign
          </Button>
          <Button variant="outline" onClick={() => setSelected([])}>
            Clear selection
          </Button>
        </div>
      )}
      <DataTable
        columns={cols}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onRowHref={(l) => `/leads/${l.id}`}
        selection={
          canAct ? { getId: (l) => l.id, selectedIds: selected, onChange: setSelected } : undefined
        }
        emptyState={
          <EmptyState
            icon={Users}
            title="No leads match these filters"
            description="Clear the search or pick other filters."
          />
        }
      />
    </div>
  );
}
