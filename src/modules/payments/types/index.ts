import { z } from 'zod';

const blank = (v: unknown) => (v === '' ? undefined : v);

export const PAYMENT_STATUSES = ['CREATED', 'PAID', 'EXPIRED', 'REFUNDED', 'FAILED'] as const;
export const METHOD_LABEL = {
  RAZORPAY: 'Razorpay',
  CASH: 'Cash',
  BANK: 'Bank transfer',
  UPI_MANUAL: 'UPI (manual)',
} as const;
export const MANUAL_METHODS = ['CASH', 'BANK', 'UPI_MANUAL'] as const;

export const paymentFiltersSchema = z.object({
  q: z.preprocess(blank, z.string().trim().max(100).optional()),
  status: z.preprocess(blank, z.enum(PAYMENT_STATUSES).optional()).catch(undefined),
  method: z.preprocess(blank, z.enum(['RAZORPAY', ...MANUAL_METHODS]).optional()).catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(25),
});
export type PaymentFilters = z.infer<typeof paymentFiltersSchema>;

/** Shared by the manual payment form and its server action. Amount entered in rupees. */
export const manualPaymentSchema = z.object({
  enrollmentId: z.uuid('Choose the enrollment'),
  method: z.enum(MANUAL_METHODS, 'Choose how they paid'),
  rupees: z
    .number('Enter the amount received')
    .positive('Enter the amount received')
    .max(1_000_000)
    .multipleOf(0.01, 'Use at most 2 decimals'),
});
export type ManualPaymentInput = z.infer<typeof manualPaymentSchema>;
