import 'server-only';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { transition } from '@/modules/leads';
import { getSetting } from '@/modules/settings';
import { reaskCurrent } from './engine';

const HOUR = 3_600_000;
const DROP_AFTER_HOURS = 24; // the free-form window closes; only templates after this

/**
 * Every 30 min: leads stuck mid-script get the pending question again at each
 * `nudge_after_hours` mark (default 3 h and 22 h after their last message), and are DROPPED after 24 h.
 */
export async function runNudges() {
  const at = await now();
  const marks = await getSetting('nudge_after_hours');
  const stuck = await db.lead.findMany({
    where: { status: 'ASKING', optedOutAt: null, lastInboundAt: { not: null } },
  });
  const result = { nudged: 0, dropped: 0, failed: [] as string[] };
  for (const lead of stuck) {
    const hours = (at.getTime() - lead.lastInboundAt!.getTime()) / HOUR;
    try {
      if (hours >= DROP_AFTER_HOURS) {
        await transition(lead.id, 'DROPPED', { actor: 'cron', note: 'No reply for 24 h' });
        result.dropped++;
      } else if (lead.remindersSent < marks.length && hours >= marks[lead.remindersSent]) {
        await db.lead.update({
          where: { id: lead.id },
          data: { remindersSent: { increment: 1 } },
        });
        await reaskCurrent(lead, { prefix: 'Just checking in!', sentBy: 'cron' });
        result.nudged++;
      }
    } catch (e) {
      result.failed.push(`${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return result;
}
