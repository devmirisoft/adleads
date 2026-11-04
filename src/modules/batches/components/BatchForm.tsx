'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/modules/core/components';
import { saveBatchAction } from '../services/actions';
import type { BatchListItem } from '../services/queries';
import type { LinkKind } from '@/modules/core/types';
import { batchInputSchema, type BatchInput, type LinkChange, type SendNewLink } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ymd = (d: Date | string) => new Date(d).toISOString().slice(0, 10);
const people = (n: number) => (n === 1 ? '1 person' : `${n} people`);

const NEW_LINK_PROMPT: Record<LinkKind, (n: number) => string> = {
  trial: (n) => `Send the new trial link to ${people(n)} currently on trial in this batch?`,
  paid: (n) => `Send the new paid link to ${people(n)} with a paid enrollment in this batch?`,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; name: string }[];
  /** Edit this batch; omit to create. */
  batch?: BatchListItem;
  /** Needed with `batch`: offered when a save changes one of its links. */
  sendNewLink?: SendNewLink;
};

/** Create / edit a batch. If an edit changes a link, offers to send it to the people it's for. */
export function BatchFormDialog({ open, onOpenChange, courses, batch, sendNewLink }: Props) {
  const router = useRouter();
  const [linkPrompts, setLinkPrompts] = useState<LinkChange[]>([]);
  const prompt = linkPrompts[0];

  function promptDone() {
    const rest = linkPrompts.slice(1);
    setLinkPrompts(rest);
    if (!rest.length) router.refresh();
  }

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BatchInput>({
    resolver: zodResolver(batchInputSchema),
    defaultValues: batch
      ? {
          courseId: batch.courseId,
          name: batch.name,
          daysOfWeek: batch.daysOfWeek,
          startTime: batch.startTime,
          endTime: batch.endTime,
          startDate: ymd(batch.startDate),
          endDate: ymd(batch.endDate),
          capacity: batch.capacity,
          zoomHostUser: batch.zoomHostUser ?? '',
          trialLink: batch.trialLink ?? '',
          paidLink: batch.paidLink ?? '',
        }
      : { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '20:00', capacity: 20 },
  });

  async function onSubmit(values: BatchInput) {
    const res = await saveBatchAction(batch?.id ?? null, values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(batch ? 'Batch saved' : 'Batch created');
    if (!batch) reset();
    onOpenChange(false);
    if (res.data.length) setLinkPrompts(res.data);
    else router.refresh();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-svh overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{batch ? `Edit ${batch.name}` : 'Add batch'}</DialogTitle>
            <DialogDescription>
              Times are IST. Seats taken so far: {batch?.seatsTaken ?? 0}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="b-course" label="Course" required error={errors.courseId?.message}>
                <Controller
                  control={control}
                  name="courseId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        id="b-course"
                        className="w-full"
                        aria-invalid={!!errors.courseId}
                      >
                        <SelectValue placeholder="Choose a course" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FormField>
              <FormField
                id="b-name"
                label="Name"
                required
                help="Shown to leads, e.g. “Evening Mon–Fri”"
                error={errors.name?.message}
              >
                <Input id="b-name" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>
            </div>
            <FormField id="b-days" label="Days" required error={errors.daysOfWeek?.message}>
              <Controller
                control={control}
                name="daysOfWeek"
                render={({ field }) => (
                  <div id="b-days" className="flex flex-wrap gap-4">
                    {DAYS.map((d, i) => (
                      <div key={d} className="flex items-center gap-2">
                        <Checkbox
                          id={`b-day-${i + 1}`}
                          checked={field.value?.includes(i + 1)}
                          onCheckedChange={(on) =>
                            field.onChange(
                              on
                                ? [...(field.value ?? []), i + 1]
                                : (field.value ?? []).filter((x) => x !== i + 1),
                            )
                          }
                        />
                        <Label htmlFor={`b-day-${i + 1}`}>{d}</Label>
                      </div>
                    ))}
                  </div>
                )}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="b-start" label="Starts at" required error={errors.startTime?.message}>
                <Input
                  id="b-start"
                  type="time"
                  aria-invalid={!!errors.startTime}
                  {...register('startTime')}
                />
              </FormField>
              <FormField id="b-end" label="Ends at" required error={errors.endTime?.message}>
                <Input
                  id="b-end"
                  type="time"
                  aria-invalid={!!errors.endTime}
                  {...register('endTime')}
                />
              </FormField>
              <FormField id="b-from" label="First day" required error={errors.startDate?.message}>
                <Input
                  id="b-from"
                  type="date"
                  aria-invalid={!!errors.startDate}
                  {...register('startDate')}
                />
              </FormField>
              <FormField id="b-to" label="Last day" required error={errors.endDate?.message}>
                <Input
                  id="b-to"
                  type="date"
                  aria-invalid={!!errors.endDate}
                  {...register('endDate')}
                />
              </FormField>
              <FormField id="b-capacity" label="Seats" required error={errors.capacity?.message}>
                <Input
                  id="b-capacity"
                  type="number"
                  min={1}
                  aria-invalid={!!errors.capacity}
                  {...register('capacity', { valueAsNumber: true })}
                />
              </FormField>
              <FormField
                id="b-host"
                label="Zoom host email"
                required
                help="One host can't run two batches at once"
                error={errors.zoomHostUser?.message}
              >
                <Input
                  id="b-host"
                  type="email"
                  aria-invalid={!!errors.zoomHostUser}
                  {...register('zoomHostUser')}
                />
              </FormField>
            </div>
            <FormField
              id="b-trial-link"
              label="Trial link"
              help="Sent when a trial starts. Without it, the bot hands new bookings to staff."
              error={errors.trialLink?.message}
            >
              <Input
                id="b-trial-link"
                type="url"
                placeholder="https://"
                aria-invalid={!!errors.trialLink}
                {...register('trialLink')}
              />
            </FormField>
            <FormField
              id="b-paid-link"
              label="Paid link"
              help="Sent once payment is confirmed."
              error={errors.paidLink?.message}
            >
              <Input
                id="b-paid-link"
                type="url"
                placeholder="https://"
                aria-invalid={!!errors.paidLink}
                {...register('paidLink')}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {batch ? 'Save changes' : 'Add batch'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {prompt && batch && sendNewLink && (
        <ConfirmDialog
          key={prompt.kind}
          open
          onOpenChange={(o) => !o && promptDone()}
          title={NEW_LINK_PROMPT[prompt.kind](prompt.recipients)}
          description={`They get it on WhatsApp for ${batch.name}. If you cancel, they keep the link they already have.`}
          confirmLabel="Send new link"
          onConfirm={async () => {
            const res = await sendNewLink(batch.id, prompt.kind);
            if (res.ok) toast.success(`New ${prompt.kind} link queued for ${people(res.data)}`);
            else toast.error(res.error);
          }}
        />
      )}
    </>
  );
}
