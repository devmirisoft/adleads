'use client';

import { useMemo, useState } from 'react';
import { CreditCard, MoreHorizontal } from 'lucide-react';
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
  Money,
  StatusBadge,
  statusLabel,
  toast,
  type DataTableColumn,
} from '@/modules/core/components';
import { markRefundedAction, resendPaymentLinkAction } from '../services/actions';
import type { PaymentListItem } from '../services/queries';
import { METHOD_LABEL, PAYMENT_STATUSES } from '../types';

const leadName = (p: PaymentListItem) =>
  p.enrollment.lead.name ?? p.enrollment.lead.profileName ?? 'Unnamed lead';

function RowActions({ payment: p }: { payment: PaymentListItem }) {
  const [confirm, setConfirm] = useState(false);
  const name = leadName(p);
  const canResend = p.method === 'RAZORPAY' && (p.status === 'CREATED' || p.status === 'EXPIRED');
  if (!canResend && p.status !== 'PAID') return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${name}'s payment`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canResend && (
            <DropdownMenuItem
              onSelect={async () => {
                const res = await resendPaymentLinkAction(p.id);
                if (res.ok) toast.success(`Payment link sent to ${name}`);
                else toast.error(res.error);
              }}
            >
              Resend link
            </DropdownMenuItem>
          )}
          {p.status === 'PAID' && (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
              Mark refunded
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title={`Mark ${name}'s payment as refunded?`}
        description={`Only record a refund you've already made. ${name}'s enrollment in ${p.enrollment.batch.name} is cancelled and their Zoom link stops working.`}
        confirmLabel="Mark refunded"
        onConfirm={async () => {
          const res = await markRefundedAction(p.id);
          if (res.ok) toast.success(`${name}'s payment marked refunded`);
          else toast.error(res.error);
        }}
      />
    </>
  );
}

type Props = {
  data: PaymentListItem[];
  total: number;
  page: number;
  pageSize: number;
  canAct: boolean;
};

export function PaymentsTable({ data, total, page, pageSize, canAct }: Props) {
  const columns = useMemo<DataTableColumn<PaymentListItem>[]>(() => {
    const cols: DataTableColumn<PaymentListItem>[] = [
      {
        id: 'student',
        header: 'Student',
        cell: ({ row: { original: p } }) => (
          <div className="flex flex-col">
            <span className="font-medium">{leadName(p)}</span>
            <span className="text-xs text-muted-foreground">{p.enrollment.batch.name}</span>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Amount',
        cell: ({ row }) => <Money paise={row.original.amountPaise} />,
      },
      {
        id: 'method',
        header: 'Method',
        cell: ({ row: { original: p } }) => (
          <div className="flex flex-col">
            <span>{METHOD_LABEL[p.method]}</span>
            {p.recordedBy && (
              <span className="text-xs text-muted-foreground">by {p.recordedBy.name}</span>
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
        id: 'razorpay',
        header: 'Razorpay ids',
        cell: ({ row: { original: p } }) =>
          p.razorpayLinkId || p.razorpayPaymentId ? (
            <div className="flex flex-col text-xs">
              {p.razorpayLinkId && <span>{p.razorpayLinkId}</span>}
              {p.razorpayPaymentId && <span>{p.razorpayPaymentId}</span>}
            </div>
          ) : (
            '—'
          ),
      },
      {
        id: 'date',
        header: 'Date',
        cell: ({ row: { original: p } }) => <DateTime value={p.paidAt ?? p.createdAt} />,
      },
    ];
    if (canAct) {
      cols.push({
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => <RowActions payment={row.original} />,
      });
    }
    return cols;
  }, [canAct]);

  return (
    <DataTable
      columns={columns}
      data={data}
      total={total}
      page={page}
      pageSize={pageSize}
      onRowHref={(p) => `/leads/${p.enrollment.lead.id}`}
      emptyState={
        <EmptyState
          icon={CreditCard}
          title="No payments match these filters"
          description="Clear the search or pick another status."
        />
      }
    />
  );
}

/** search → status → method. */
export function PaymentFilterBar() {
  return (
    <FilterBar searchPlaceholder="Name, phone or Razorpay id">
      <FilterSelect
        param="status"
        label="Status"
        options={PAYMENT_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
      />
      <FilterSelect
        param="method"
        label="Method"
        options={Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label }))}
      />
    </FilterBar>
  );
}
