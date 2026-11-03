import { z } from 'zod';
import { realtime } from '@/lib/realtime/client';
import { isStaffChannel } from '@/lib/realtime/types';
import { requireUser } from '@/modules/auth';

export const maxDuration = 60;

const form = z.object({
  socket_id: z.string().regex(/^\d+\.\d+$/),
  channel_name: z.string().refine(isStaffChannel),
});

/** Signs a browser's subscription to a private channel. Any staff role may listen, VIEWER included. */
export async function POST(req: Request) {
  // requireUser() redirects to /login, which is no use to pusher-js: answer with a plain 401.
  const user = await requireUser().catch(() => null);
  if (!user) return Response.json({ error: 'Sign in required' }, { status: 401 });

  const fields = await req.formData().catch(() => new FormData());
  const parsed = form.safeParse(Object.fromEntries(fields));
  if (!parsed.success) return Response.json({ error: 'Not allowed' }, { status: 403 });

  const signed = realtime.authorize(parsed.data.socket_id, parsed.data.channel_name);
  return signed
    ? Response.json(signed)
    : Response.json({ error: 'Realtime is off' }, { status: 404 });
}
