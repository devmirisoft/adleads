import { DateTime, StatusBadge } from '@/modules/core/components';
import type { LeadDetail } from '../services/queries';

const SYSTEM_ACTORS: Record<string, string> = {
  bot: 'Bot',
  cron: 'Scheduler',
  webhook: 'WhatsApp / Razorpay',
};

/** Status history (lead_events), oldest first. `staff` maps user ids to names. */
export function LeadTimeline({
  events,
  staff,
}: {
  events: LeadDetail['events'];
  staff: Record<string, string>;
}) {
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={String(e.id)} className="flex flex-col gap-1 border-l-2 border-border pl-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={e.toStatus} />
            <span className="text-xs text-muted-foreground">
              by {SYSTEM_ACTORS[e.actor] ?? staff[e.actor] ?? 'staff'}
            </span>
          </div>
          {e.note && <p className="text-sm">{e.note}</p>}
          <span className="text-xs text-muted-foreground">
            <DateTime value={e.createdAt} />
          </span>
        </li>
      ))}
    </ol>
  );
}
