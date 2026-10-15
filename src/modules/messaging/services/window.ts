import 'server-only';
import { now } from '@/lib/clock';
import { isWithin24h } from '@/modules/core/utils';

/** Free-form (non-template) messages are allowed only within 24 h of the lead's last message. */
export async function isWindowOpen(lead: { lastInboundAt: Date | null }): Promise<boolean> {
  return isWithin24h(lead.lastInboundAt, await now());
}
