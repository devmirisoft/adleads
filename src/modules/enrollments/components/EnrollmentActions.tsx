'use client';

import { useState } from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import type { EnrollmentStatus } from '@/generated/prisma/enums';
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@/modules/core/components';
import type { ApiResult } from '@/modules/core/types';
import type { BatchOption } from '../types';
import {
  cancelEnrollmentAction,
  extendTrialAction,
  moveBatchAction,
  resendTrialLinkAction,
} from '../services/actions';

export type EnrollmentRef = {
  id: string;
  status: EnrollmentStatus;
  leadName: string;
  batch: { id: string; name: string; courseId: string };
};

type Props = {
  enrollment: EnrollmentRef;
  batches: BatchOption[];
  /** payments' requestPayment action, passed in by the page (enrollments can't import payments). */
  requestPayment?: (enrollmentId: string) => Promise<ApiResult<unknown>>;
};

async function report(p: Promise<ApiResult<unknown>>, success: string) {
  const res = await p;
  if (res.ok) toast.success(success);
  else toast.error(res.error);
  return res.ok;
}

/** ⋯ menu for one enrollment: resend link, extend, move, request payment, cancel. */
export function EnrollmentActions({ enrollment: e, batches, requestPayment }: Props) {
  const [dialog, setDialog] = useState<'extend' | 'move' | 'cancel' | null>(null);
  const live = e.status === 'TRIAL' || e.status === 'PAID';
  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${e.leadName}'s enrollment`}>
            <MoreHorizontal className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {live && (
            <DropdownMenuItem
              onSelect={() => report(resendTrialLinkAction(e.id), `Link re-sent to ${e.leadName}`)}
            >
              Resend class link
            </DropdownMenuItem>
          )}
          {e.status === 'TRIAL' && (
            <DropdownMenuItem onSelect={() => setDialog('extend')}>Extend trial</DropdownMenuItem>
          )}
          {live && (
            <DropdownMenuItem onSelect={() => setDialog('move')}>Move batch</DropdownMenuItem>
          )}
          {requestPayment && (e.status === 'TRIAL' || e.status === 'EXPIRED') && (
            <DropdownMenuItem
              onSelect={() => report(requestPayment(e.id), `Payment link sent to ${e.leadName}`)}
            >
              Request payment
            </DropdownMenuItem>
          )}
          {e.status !== 'CANCELLED' && (
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog('cancel')}>
              Cancel enrollment
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ExtendTrialDialog open={dialog === 'extend'} onClose={close} enrollment={e} />
      <MoveBatchDialog open={dialog === 'move'} onClose={close} enrollment={e} batches={batches} />
      <CancelDialog open={dialog === 'cancel'} onClose={close} enrollment={e} />
    </>
  );
}

type DialogProps = { open: boolean; onClose: () => void; enrollment: EnrollmentRef };

function ExtendTrialDialog({ open, onClose, enrollment: e }: DialogProps) {
  const [days, setDays] = useState('2');
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Extend {e.leadName}&apos;s trial</DialogTitle>
          <DialogDescription>
            Their trial in {e.batch.name} ends later by this many days.
          </DialogDescription>
        </DialogHeader>
        <FormField id="extend-days" label="Days" required help="1–30">
          <Input
            id="extend-days"
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(ev) => setDays(ev.target.value)}
          />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const ok = await report(
                extendTrialAction(e.id, Number(days)),
                `Trial extended by ${days} day(s)`,
              );
              setPending(false);
              if (ok) onClose();
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Extend trial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveBatchDialog({
  open,
  onClose,
  enrollment: e,
  batches,
}: DialogProps & { batches: BatchOption[] }) {
  const options = batches.filter((b) => b.courseId === e.batch.courseId && b.id !== e.batch.id);
  const [batchId, setBatchId] = useState('');
  const [pending, setPending] = useState(false);
  const target = options.find((b) => b.id === batchId);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {e.leadName} to another batch</DialogTitle>
          <DialogDescription>
            Frees their seat in {e.batch.name}. Their old Zoom link stops working and a new one is
            sent.
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No other batch of this course has free seats.
          </p>
        ) : (
          <FormField id="move-batch" label="New batch" required>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger id="move-batch" className="w-full">
                <SelectValue placeholder="Choose a batch" />
              </SelectTrigger>
              <SelectContent>
                {options.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} · {b.seatsLeft} seat{b.seatsLeft === 1 ? '' : 's'} left
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!target || pending}
            onClick={async () => {
              setPending(true);
              const ok = await report(
                moveBatchAction(e.id, batchId),
                `${e.leadName} moved to ${target?.name}`,
              );
              setPending(false);
              if (ok) onClose();
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Move batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ open, onClose, enrollment: e }: DialogProps) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      tone="danger"
      title={`Cancel ${e.leadName}'s enrollment in ${e.batch.name}?`}
      description="Their Zoom link will stop working, their seat is freed and the lead is closed."
      confirmLabel="Cancel enrollment"
      onConfirm={async () => {
        await report(cancelEnrollmentAction(e.id, reason), `${e.leadName}'s enrollment cancelled`);
        setReason('');
      }}
    >
      <FormField id="cancel-reason" label="Reason">
        <Textarea
          id="cancel-reason"
          rows={2}
          value={reason}
          onChange={(ev) => setReason(ev.target.value)}
        />
      </FormField>
    </ConfirmDialog>
  );
}
