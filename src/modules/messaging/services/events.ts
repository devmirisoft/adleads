import 'server-only';
import type { Message } from '@/generated/prisma/client';
import { publish, publishInboxChanged } from '@/lib/realtime/client';
import { leadChannel } from '@/lib/realtime/types';
import type { ChatEvent } from '../types';
import { toChatMessage } from '../utils/thread';

// Pusher rejects events over 10 KB. A long Hindi message or a 10-row list can pass that,
// so the thread is told to fetch the row itself instead.
const MAX_EVENT_BYTES = 9000;

/** Push a saved row to staff browsers. Never rejects. Call after the write commits. */
export async function publishMessage(event: 'message.created' | 'message.status', row: Message) {
  const message = toChatMessage(row);
  const data: ChatEvent =
    Buffer.byteLength(JSON.stringify(message)) > MAX_EVENT_BYTES ? { refetch: true } : { message };
  await Promise.all([
    publish(leadChannel(row.leadId), event, data),
    // A new message changes who wrote last, and a failed one flags the lead: both move the inbox.
    ...(event === 'message.created' || row.status === 'FAILED' ? [publishInboxChanged()] : []),
  ]);
}
