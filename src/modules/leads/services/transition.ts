import 'server-only';
import { db, type Tx } from '@/lib/db';
import { canTransition, type LeadStatus } from '../constants/statuses';

export class IllegalTransitionError extends Error {
  name = 'IllegalTransitionError';
  constructor(
    readonly from: LeadStatus,
    readonly to: LeadStatus,
  ) {
    super(`A lead can't move from ${from} to ${to}`);
  }
}

/** "bot" | "cron" | "webhook" | a user id */
export type Actor = string;

/**
 * The ONLY writer of lead.status. Checks the allowed-transitions map, writes the LeadEvent.
 * Pass `tx` to join the caller's transaction; otherwise runs in its own.
 */
export async function transition(
  leadId: string,
  to: LeadStatus,
  { actor, note }: { actor: Actor; note?: string },
  tx?: Tx,
): Promise<void> {
  const run = async (t: Tx) => {
    const { status: from } = await t.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { status: true },
    });
    if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
    // Guard on the status we read, so a concurrent change can't be silently overwritten.
    const { count } = await t.lead.updateMany({
      where: { id: leadId, status: from },
      data: { status: to, ...(to === 'OPTED_OUT' && { optedOutAt: new Date() }) },
    });
    if (count === 0) throw new Error(`Lead ${leadId} changed status while moving to ${to}; retry`);
    await t.leadEvent.create({ data: { leadId, fromStatus: from, toStatus: to, actor, note } });
  };
  await (tx ? run(tx) : db.$transaction(run));
}
