import { z } from 'zod';
import { LEAD_STATUS } from '../constants/statuses';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

/** Lead list filters, parsed from URL search params (unknown/blank values are dropped). */
export const leadFiltersSchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(100).optional()),
  status: z.preprocess(blankToUndefined, z.enum(LEAD_STATUS).optional()).catch(undefined),
  courseId: z.preprocess(blankToUndefined, z.uuid().optional()).catch(undefined),
  batchId: z.preprocess(blankToUndefined, z.uuid().optional()).catch(undefined),
  source: z
    .preprocess(blankToUndefined, z.enum(['CTWA_AD', 'LEAD_FORM', 'ORGANIC', 'MANUAL']).optional())
    .catch(undefined),
  from: z.preprocess(blankToUndefined, ymd.optional()).catch(undefined),
  to: z.preprocess(blankToUndefined, ymd.optional()).catch(undefined),
  needsHuman: z.preprocess((v) => v === '1' || v === 'true', z.boolean()),
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(25),
});
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
