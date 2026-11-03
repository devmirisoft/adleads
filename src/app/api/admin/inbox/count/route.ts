import { requireUser } from '@/modules/auth';
import { countInbox } from '@/modules/leads';

/** The Inbox nav badge, refetched when `inbox.changed` arrives. */
export async function GET() {
  await requireUser();
  return Response.json({ count: await countInbox() }, { headers: { 'Cache-Control': 'no-store' } });
}
