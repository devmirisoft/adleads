import { z } from 'zod';
import type { ApiResult, LinkKind } from '@/modules/core/types';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm, e.g. 19:00');
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date');
const blank = (v: unknown) => (v === '' ? undefined : v);
/** Optional, and pasted into WhatsApp messages: a real https:// URL with no spaces. Blank = none yet. */
const classLink = z
  .string()
  .trim()
  .max(500, 'Keep it under 500 characters')
  .refine((v) => v === '' || (/^https:\/\/\S+$/.test(v) && URL.canParse(v)), {
    message: 'Paste the full link, starting with https://',
  })
  .optional();

/** Shared by the batch form and the create/update services. Dates are IST calendar dates. */
export const batchInputSchema = z
  .object({
    courseId: z.uuid('Pick a course'),
    name: z.string().trim().min(2, 'At least 2 characters').max(60, 'Keep it under 60 characters'),
    /** 1 = Mon … 7 = Sun */
    daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Pick at least one day'),
    startTime: hhmm,
    endTime: hhmm,
    startDate: ymd,
    endDate: ymd,
    capacity: z
      .number('Enter a number')
      .int('Whole numbers only')
      .min(1, 'At least 1 seat')
      .max(500),
    zoomHostUser: z.email('Enter the Zoom host’s email'),
    trialLink: classLink,
    paidLink: classLink,
  })
  .refine((b) => b.endTime > b.startTime, {
    path: ['endTime'],
    message: 'Must be after the start time',
  })
  .refine((b) => b.endDate >= b.startDate, {
    path: ['endDate'],
    message: 'Must be on or after the start date',
  });
export type BatchInput = z.infer<typeof batchInputSchema>;

/** A link this save changed to a new value, and how many people could be sent it. */
export type LinkChange = { kind: LinkKind; recipients: number };
/** Queues the new link for everyone holding the old one. Returns how many sends were queued. */
export type SendNewLink = (batchId: string, kind: LinkKind) => Promise<ApiResult<number>>;

/** Shared by the course form and its server action. Fee entered in rupees. */
export const courseInputSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100, 'Keep it under 100 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Add a short description')
    .max(72, 'WhatsApp shows at most 72 characters here'),
  feeRupees: z
    .number('Enter the fee')
    .positive('Enter the fee')
    .max(1_000_000)
    .multipleOf(0.01, 'Use at most 2 decimals'),
  /** null → the default from Settings. */
  trialDays: z.number().int('Whole days only').min(1).max(30).nullable(),
  sortOrder: z.number('Enter a number').int('Whole numbers only').min(0).max(999),
  isActive: z.boolean(),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export const batchFiltersSchema = z.object({
  q: z.preprocess(blank, z.string().trim().max(100).optional()),
  status: z.preprocess(blank, z.enum(['OPEN', 'FULL', 'CLOSED']).optional()).catch(undefined),
  courseId: z.preprocess(blank, z.uuid().optional()).catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(25),
});
export type BatchFilters = z.infer<typeof batchFiltersSchema>;
