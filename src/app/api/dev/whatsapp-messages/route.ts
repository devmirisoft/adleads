import type { NextRequest } from 'next/server';
import { normalizePhone } from '@/modules/core/utils';
import { findLeadIdByPhone } from '@/modules/leads';
import { listMessages } from '@/modules/messaging';

/** Dev simulator polling: the thread for one phone number. */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const phone = normalizePhone(req.nextUrl.searchParams.get('phone') ?? '');
  const leadId = phone ? await findLeadIdByPhone(phone) : null;
  return Response.json({ messages: leadId ? await listMessages(leadId) : [] });
}
