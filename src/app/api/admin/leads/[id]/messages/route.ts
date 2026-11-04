import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/modules/auth';
import { listMessages } from '@/modules/messaging';

const sinceParam = z.coerce.date().optional();

/** Chat polling for the lead detail page. `?since=` (the previous reply's `at`) returns only what changed. */
export async function GET(
  req: NextRequest,
  { params }: RouteContext<'/api/admin/leads/[id]/messages'>,
) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const since = sinceParam.safeParse(req.nextUrl.searchParams.get('since') ?? undefined);
  if (!since.success) return Response.json({ error: 'Invalid since' }, { status: 400 });
  const at = new Date().toISOString(); // before the read, so nothing changing during it is skipped
  return Response.json({ messages: await listMessages(id, since.data), at });
}
