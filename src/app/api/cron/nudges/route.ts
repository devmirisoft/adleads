import { runNudges } from '@/modules/bot';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';

// Every 30 minutes.
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json(await runNudges());
}
