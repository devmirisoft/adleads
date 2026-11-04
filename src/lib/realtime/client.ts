import 'server-only';
import { config } from '../config';
import { fakeRealtime } from './fake';
import { liveRealtime } from './live';
import { INBOX_CHANNEL, type RealtimeClient, type RealtimePublicConfig } from './types';

export const realtime: RealtimeClient =
  config.REALTIME_MODE === 'pusher' ? liveRealtime : fakeRealtime;

/**
 * Push an event to staff browsers. Call it after the DB write commits, never inside a transaction.
 * Best effort and never rejects: the row is already saved, and browsers catch up when they
 * reconnect. Logs the event and error name only, because Pusher's errors carry the signed URL and body.
 */
export async function publish(channel: string, event: string, data: unknown): Promise<void> {
  try {
    await realtime.publish(channel, event, data);
  } catch (e) {
    const { name, status } = e as { name?: string; status?: number };
    console.error('[realtime] publish failed', { event, name, status });
  }
}

/** The inbox list or nav badge may have changed (needsHuman, or who wrote last). */
export const publishInboxChanged = () => publish(INBOX_CHANNEL, 'inbox.changed', {});

/** For server components to hand to the browser; null means the browser polls instead. */
export function realtimePublicConfig(): RealtimePublicConfig | null {
  return config.REALTIME_MODE === 'pusher'
    ? { key: config.PUSHER_KEY!, cluster: config.PUSHER_CLUSTER! }
    : null;
}
