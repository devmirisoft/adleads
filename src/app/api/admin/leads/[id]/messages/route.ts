import { requireUser } from '@/modules/auth';
import { listMessages } from '@/modules/messaging';

/** Chat polling for the lead detail page. */
export async function GET(
  _req: Request,
  { params }: RouteContext<'/api/admin/leads/[id]/messages'>,
) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ messages: await listMessages(id) });
}
