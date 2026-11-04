'use server';
import 'server-only';
import type { LinkKind } from '@/modules/core/types';
import { queueNewLinkAction } from '@/modules/enrollments';
import { recordManualPaymentAction, type ManualPaymentInput } from '@/modules/payments';
import { runJobsAfterResponse } from './handlers';

// Here, not in the feature modules, because modules can't reach the job handlers.

/** Sends the confirmation right away. */
export async function recordManualPaymentAndRunJobs(input: ManualPaymentInput) {
  const res = await recordManualPaymentAction(input);
  if (res.ok) runJobsAfterResponse();
  return res;
}

/** Sends right away. */
export async function sendNewBatchLink(batchId: string, kind: LinkKind) {
  const res = await queueNewLinkAction(batchId, kind);
  if (res.ok) runJobsAfterResponse();
  return res;
}
