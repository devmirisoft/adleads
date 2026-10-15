import { z } from 'zod';

const blank = (v: unknown) => (v === '' ? undefined : v);

export const enrollmentFiltersSchema = z.object({
  q: z.preprocess(blank, z.string().trim().max(100).optional()),
  status: z
    .preprocess(blank, z.enum(['TRIAL', 'PAID', 'EXPIRED', 'CANCELLED']).optional())
    .catch(undefined),
  batchId: z.preprocess(blank, z.uuid().optional()).catch(undefined),
  /** Trials whose last day is within the next N days. */
  endingInDays: z
    .preprocess(blank, z.coerce.number().int().min(0).max(30).optional())
    .catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(25),
});
export type EnrollmentFilters = z.infer<typeof enrollmentFiltersSchema>;

/** A batch offered in assign / move dialogs. */
export type BatchOption = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  seatsLeft: number;
};
