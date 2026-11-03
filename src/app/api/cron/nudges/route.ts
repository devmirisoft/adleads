import { runNudges } from '@/modules/bot';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';

export const maxDuration = 60;

// Every 30 minutes.
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json(await runNudges());
}
