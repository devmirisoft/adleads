'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/modules/core/components';
import { assignBatchAction } from '../services/actions';
import type { BatchOption } from '../types';

/** Book a trial seat for a lead by hand (they didn't finish the bot, or were waitlisted). */
export function AssignBatchDialog({
  leadId,
  leadName,
  courseId,
  batches,
}: {
  leadId: string;
  leadName: string;
  /** Lead's chosen course: its batches are listed first. */
  courseId: string | null;
  batches: BatchOption[];
}) {
  const [open, setOpen] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [pending, setPending] = useState(false);
  const sorted = [...batches].sort(
    (a, b) => Number(b.courseId === courseId) - Number(a.courseId === courseId),
  );
  const target = sorted.find((b) => b.id === batchId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Assign batch</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign {leadName} to a batch</DialogTitle>
          <DialogDescription>
            Starts their free trial and sends their personal Zoom link.
          </DialogDescription>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No batch has free seats right now.</p>
        ) : (
          <FormField id="assign-batch" label="Batch" required>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger id="assign-batch" className="w-full">
                <SelectValue placeholder="Choose a batch" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.courseName} · {b.name} · {b.seatsLeft} left
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!target || pending}
            onClick={async () => {
              setPending(true);
              const res = await assignBatchAction(leadId, batchId);
              setPending(false);
              if (!res.ok) return void toast.error(res.error);
              toast.success(`${leadName} booked into ${target?.name}`);
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Assign batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
