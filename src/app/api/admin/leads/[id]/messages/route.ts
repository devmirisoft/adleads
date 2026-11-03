import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/modules/auth';
import { listMessages, listMessagesSince } from '@/modules/messaging';

const query = z.object({ after: z.iso.datetime().optional(), before: z.uuid().optional() });

/**
 * Chat fallback for the lead detail page. The newest page, or `?before=<message id>` for the page
 * older than it, or `?after=<cursor>` for only what changed since the last poll's `cursor`.
 */
export async function GET(
  req: NextRequest,
  { params }: RouteContext<'/api/admin/leads/[id]/messages'>,
) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const q = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!q.success) return Response.json({ error: 'Invalid cursor' }, { status: 400 });
  const { after, before } = q.data;
  const page = after
    ? await listMessagesSince(id, new Date(after))
    : await listMessages(id, { before });
  return Response.json(page, { headers: { 'Cache-Control': 'no-store' } });
}
