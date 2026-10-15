import { runTrialsCron } from '@/modules/payments';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';

// Daily 09:00 IST.
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json(await runTrialsCron());
}
