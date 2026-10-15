'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@/modules/core/components';
import { formatMoney } from '@/modules/core/utils';
import { recordManualPaymentAction } from '../services/actions';
import type { PayableEnrollment } from '../services/queries';
import {
  MANUAL_METHODS,
  manualPaymentSchema,
  METHOD_LABEL,
  type ManualPaymentInput,
} from '../types';

/** "Record manual payment": cash / bank / UPI received outside Razorpay → markPaid. */
export function ManualPaymentDialog({
  enrollments,
  enrollmentId,
}: {
  enrollments: PayableEnrollment[];
  /** Preselect (lead detail page). */
  enrollmentId?: string;
}) {
  const [open, setOpen] = useState(false);
  const feeOf = (id?: string) => enrollments.find((e) => e.id === id)?.feePaise;
  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,

    formState: { errors, isSubmitting },
  } = useForm<ManualPaymentInput>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: { enrollmentId, rupees: (feeOf(enrollmentId) ?? 0) / 100 || undefined },
  });
  const fee = feeOf(useWatch({ control, name: 'enrollmentId' }));

  async function onSubmit(values: ManualPaymentInput) {
    const res = await recordManualPaymentAction(values);
    if (!res.ok) return void toast.error(res.error);
    toast.success('Payment recorded — the lead is enrolled');
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={enrollmentId ? 'outline' : 'default'}>
          <Plus className="size-4" aria-hidden />
          Record manual payment
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record manual payment</DialogTitle>
          <DialogDescription>
            For cash, bank transfer or UPI received outside Razorpay. The lead is enrolled if the
            amount matches the fee.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <FormField
            id="mp-enrollment"
            label="Enrollment"
            required
            error={errors.enrollmentId?.message}
          >
            <Controller
              control={control}
              name="enrollmentId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    const f = feeOf(v);
                    if (f) setValue('rupees', f / 100);
                  }}
                >
                  <SelectTrigger
                    id="mp-enrollment"
                    className="w-full"
                    aria-invalid={!!errors.enrollmentId}
                  >
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {enrollments.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="mp-method" label="Method" required error={errors.method?.message}>
              <Controller
                control={control}
                name="method"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="mp-method" className="w-full" aria-invalid={!!errors.method}>
                      <SelectValue placeholder="How they paid" />
                    </SelectTrigger>
                    <SelectContent>
                      {MANUAL_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {METHOD_LABEL[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="mp-amount"
              label="Amount received (₹)"
              required
              help={fee ? `Course fee: ${formatMoney(fee)}` : undefined}
              error={errors.rupees?.message}
            >
              <Input
                id="mp-amount"
                type="number"
                step="0.01"
                min={0}
                aria-invalid={!!errors.rupees}
                {...register('rupees', { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Mark paid
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
