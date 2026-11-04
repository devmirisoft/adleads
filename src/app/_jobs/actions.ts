'use server';
import 'server-only';
import { recordManualPaymentAction, type ManualPaymentInput } from '@/modules/payments';
import { runJobsAfterResponse } from './handlers';

/** Here, not in the payments module, because modules can't reach the job handlers. Sends the confirmation right away. */
export async function recordManualPaymentAndRunJobs(input: ManualPaymentInput) {
  const res = await recordManualPaymentAction(input);
  if (res.ok) runJobsAfterResponse();
  return res;
}
