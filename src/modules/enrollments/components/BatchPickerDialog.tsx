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
import type { ApiResult } from '@/modules/core/types';
import type { BatchOption } from '../types';

/** Pick a batch for a lead, then run an action on it. Lead's chosen course is listed first. */
export function BatchPickerDialog({
  action,
  variant,
  title,
  description,
  emptyText,
  courseId,
  batches,
  run,
  success,
}: {
  /** Button label, on the trigger and in the dialog. */
  action: string;
  variant?: 'outline';
  title: string;
  description: string;
  emptyText: string;
  courseId: string | null;
  batches: BatchOption[];
  run: (batchId: string) => Promise<ApiResult<unknown>>;
  success: (batch: BatchOption) => string;
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
        <Button variant={variant}>{action}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <FormField id="pick-batch" label="Batch" required>
            <Select value={batchId} onValueChange={setBatchId}>
              <SelectTrigger id="pick-batch" className="w-full">
                <SelectValue placeholder="Choose a batch" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.courseName} · {b.name}
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
              if (!target) return;
              setPending(true);
              const res = await run(target.id);
              setPending(false);
              if (!res.ok) return void toast.error(res.error);
              toast.success(success(target));
              setOpen(false);
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
