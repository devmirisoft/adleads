import { runDue } from '@/modules/jobs';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';
import { jobHandlers } from '../../../_jobs/handlers';

// Every minute.
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json(await runDue(jobHandlers, 50));
}

// Vercel Cron sends GET.
export const GET = POST;
