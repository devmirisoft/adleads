'use server';
import 'server-only';
import type { LinkKind } from '@/modules/core/types';
import { queueNewLinkAction } from '@/modules/enrollments';
import { runJobsAfterResponse } from './handlers';

/** Here, not in the enrollments module, because modules can't reach the job handlers. Sends right away. */
export async function sendNewBatchLink(batchId: string, kind: LinkKind) {
  const res = await queueNewLinkAction(batchId, kind);
  if (res.ok) runJobsAfterResponse();
  return res;
}
