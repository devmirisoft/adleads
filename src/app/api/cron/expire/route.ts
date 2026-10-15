import { expireDueTrials } from '@/modules/payments';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';

// Daily 23:30 IST.
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json(await expireDueTrials());
}
