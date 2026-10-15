'use client';

import { useState } from 'react';
import {
  Button,
  ConfirmDialog,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  statusLabel,
  toast,
} from '@/modules/core/components';
import { canTransition, MANUAL_STATUS_TARGETS, type LeadStatus } from '../constants/statuses';
import { changeStatus } from '../services/actions';

/** "Change status" — only legal moves that have no side effects of their own. */
export function LeadStatusControl({
  leadId,
  leadName,
  status,
}: {
  leadId: string;
  leadName: string;
  status: LeadStatus;
}) {
  const targets = MANUAL_STATUS_TARGETS.filter((t) => canTransition(status, t));
  const [to, setTo] = useState<LeadStatus | ''>('');
  const [open, setOpen] = useState(false);
  if (targets.length === 0) {
    return <p className="text-xs text-muted-foreground">No manual status changes from here.</p>;
  }

  const destructive = to === 'CANCELLED' || to === 'OPTED_OUT';
  return (
    <div className="flex items-center gap-2">
      <Select value={to} onValueChange={(v) => setTo(v as LeadStatus)}>
        <SelectTrigger className="w-44" aria-label="New status">
          <SelectValue placeholder="Change status…" />
        </SelectTrigger>
        <SelectContent>
          {targets.map((t) => (
            <SelectItem key={t} value={t}>
              {statusLabel(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" disabled={!to} onClick={() => setOpen(true)}>
        Change status
      </Button>
      {to && (
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          tone={destructive ? 'danger' : 'default'}
          title={`Change ${leadName}'s status to ${statusLabel(to)}?`}
          description={
            to === 'OPTED_OUT'
              ? 'They will get no more WhatsApp messages from us, including templates.'
              : to === 'CANCELLED'
                ? 'The lead is closed for good and can’t be reopened.'
                : 'This is logged in their status timeline.'
          }
          confirmLabel="Change status"
          onConfirm={async () => {
            const res = await changeStatus(leadId, to);
            if (res.ok) {
              toast.success(`Status changed to ${statusLabel(to)}`);
              setTo('');
            } else toast.error(res.error);
          }}
        />
      )}
    </div>
  );
}
