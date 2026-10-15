'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Checkbox,
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
import { batchInputSchema, type BatchInput } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ymd = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: { id: string; name: string }[];
  /** Edit this batch; omit to create. */
  batch?: BatchListItem;
};

/** Create / edit a batch. Creating also sets up its recurring Zoom meeting. */
export function BatchFormDialog({ open, onOpenChange, courses, batch }: Props) {
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
        }
      : { daysOfWeek: [1, 2, 3, 4, 5], startTime: '19:00', endTime: '20:00', capacity: 20 },
  });

  async function onSubmit(values: BatchInput) {
    const res = await saveBatchAction(batch?.id ?? null, values);
    if (!res.ok) return void toast.error(res.error);
    toast.success(batch ? 'Batch saved' : 'Batch created with its Zoom meeting');
    if (!batch) reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
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
  );
}
