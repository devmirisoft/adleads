// Realtime adapter contract, plus the channels staff browsers listen to. No secrets, so client
// code may import this file. Private channels only: message content never goes on a public one.

export interface RealtimeClient {
  publish(channel: string, event: string, data: unknown): Promise<void>;
  /** Signs a browser's subscription to a private channel. null when realtime is off. */
  authorize(socketId: string, channel: string): { auth: string } | null;
}

/** What a browser needs to connect. Pusher's key and cluster are public by design. */
export type RealtimePublicConfig = { key: string; cluster: string };

export const INBOX_CHANNEL = 'private-inbox';
export const leadChannel = (leadId: string) => `private-lead-${leadId}`;

const STAFF_CHANNEL =
  /^private-(inbox|lead-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** The only channels a browser may ask to join. */
export const isStaffChannel = (channel: string) => STAFF_CHANNEL.test(channel);
