'use client';

import { Inbox } from 'lucide-react';
import {
  DataTable,
  DateTime,
  EmptyState,
  Phone,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  type DataTableColumn,
} from '@/modules/core/components';
import { useQueryState } from '@/modules/core/hooks';
import type { LeadListItem } from '../services/queries';
import { leadName } from '../utils';
import { ResolveButton } from './ResolveButton';

const preview = (body: unknown) =>
  body && typeof body === 'object' && 'text' in body ? String(body.text ?? '') : '';

const baseColumns: DataTableColumn<LeadListItem>[] = [
  {
    id: 'lead',
    header: 'Lead',
    cell: ({ row: { original: l } }) => (
      <div className="flex flex-col items-start gap-1">
        <span className="font-medium">{leadName(l)}</span>
        <Phone e164={l.phoneE164} />
      </div>
    ),
  },
  {
    id: 'why',
    header: 'Why',
    cell: ({ row: { original: l } }) => (
      <div className="flex flex-wrap gap-1">
        {l.needsHuman && <StatusBadge status="NEEDS_HUMAN" />}
        {l.messages[0]?.direction === 'IN' && l.messages[0].status !== 'READ' && (
          <StatusBadge status="UNREAD" />
        )}
      </div>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    id: 'last',
    header: 'Last message',
    cell: ({ row }) => {
      const m = row.original.messages[0];
      return m ? (
        <div className="flex max-w-sm flex-col">
          <span className="truncate">{preview(m.body) || 'Template / media'}</span>
          <span className="text-xs text-muted-foreground">
            <DateTime value={m.createdAt} relative />
          </span>
        </div>
      ) : (
        '—'
      );
    },
  },
  {
    id: 'assigned',
    header: 'Assigned to',
    cell: ({ row }) => row.original.assignedTo?.name ?? '—',
  },
];

const withResolve: DataTableColumn<LeadListItem>[] = [
  ...baseColumns,
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <ResolveButton leadId={row.original.id} />,
  },
];

export function InboxTable({
  data,
  total,
  page,
  pageSize,
  canAct,
}: {
  data: LeadListItem[];
  total: number;
  page: number;
  pageSize: number;
  canAct: boolean;
}) {
  const [view, setView] = useQueryState('view');
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={view || 'all'} onValueChange={(v) => setView(v === 'all' ? null : v)}>
        <TabsList>
          <TabsTrigger value="mine">Assigned to me</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={canAct ? withResolve : baseColumns}
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        onRowHref={(l) => `/leads/${l.id}`}
        emptyState={
          <EmptyState
            icon={Inbox}
            title="Inbox zero"
            description={
              view === 'mine'
                ? 'Nothing assigned to you is waiting. Check “All”.'
                : 'No lead is waiting for a reply.'
            }
          />
        }
      />
    </div>
  );
}
