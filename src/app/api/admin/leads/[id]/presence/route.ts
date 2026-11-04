import { after } from 'next/server';
import { z } from 'zod';
import { CAN_ACT, requireRole } from '@/modules/auth';
import { markInboundRead, showTyping } from '@/modules/messaging';

const body = z.object({ action: z.enum(['read', 'typing']) });

/**
 * Staff opened the thread or is typing: tell the lead's phone. A route, not a server action,
 * because Next runs actions one at a time per client and a send must never wait behind this.
 */
export async function POST(
  req: Request,
  { params }: RouteContext<'/api/admin/leads/[id]/presence'>,
) {
  await requireRole(...CAN_ACT); // VIEWER is read-only: looking at a thread mustn't send ticks
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Unknown action' }, { status: 400 });
  after(() => (parsed.data.action === 'typing' ? showTyping(id) : markInboundRead(id)));
  return new Response(null, { status: 202 });
}
