import { runNudges } from '@/modules/bot';
import { runWaitlistOffers } from '@/modules/enrollments';
import { runCourseLinks } from '@/modules/payments';
import { isCronRequest, unauthorized } from '../../../_jobs/cronAuth';

export const maxDuration = 60;

// Every 30 minutes: bot nudges, waitlist offers, course links (+ payment reminder after the last one).
export async function POST(req: Request) {
  if (!isCronRequest(req)) return unauthorized();
  return Response.json({
    ...(await runNudges()),
    offers: await runWaitlistOffers(),
    links: await runCourseLinks(),
  });
}
