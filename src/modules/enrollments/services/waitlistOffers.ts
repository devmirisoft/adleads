import 'server-only';
import { now } from '@/lib/clock';
import { db, type Tx } from '@/lib/db';
import { publishInboxChanged } from '@/lib/realtime/client';
import { istDate } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { transition, type Actor } from '@/modules/leads';
import { isLive, lockBatch, WAITING, type LockedBatch } from './assignSeat';
import { firstName } from './sendTrialLink';

// An offer lets a waitlisted lead book a batch until it lapses. Seats are unlimited, so offers
// don't ration anything; they're made under the batch's row lock so two runs don't offer the same
// lead twice. A partial unique index stops one lead holding two offers if two batches offer to
// them at once: that run rolls back and the next one retries.

const OFFER_WINDOW_MS = 24 * 3_600_000;

async function createOffer(
  tx: Tx,
  lead: { id: string; name: string | null; profileName: string | null },
  batch: LockedBatch,
  at: Date,
  actor: Actor,
) {
  await tx.waitlistOffer.create({
    data: {
      leadId: lead.id,
      batchId: batch.id,
      offeredBy: actor,
      offeredAt: at,
      expiresAt: new Date(at.getTime() + OFFER_WINDOW_MS),
    },
  });
  await enqueue(
    'sendMessage',
    {
      leadId: lead.id,
      template: 'waitlist_seat_open',
      vars: { name: firstName(lead), batch: batch.name },
      sentBy: actor,
    },
    { tx },
  );
}

/** Staff offer a seat by hand: no cooldown, and it replaces any offer the lead already holds. */
export async function offerSeat(leadId: string, batchId: string, { actor }: { actor: Actor }) {
  const at = await now();
  await db.$transaction(async (tx) => {
    const batch = await lockBatch(tx, batchId);
    const lead = await tx.lead.findUniqueOrThrow({ where: { id: leadId } });
    if (lead.status !== 'WAITLISTED') {
      throw new Error('Only waitlisted leads can be offered a seat.');
    }
    if (!isLive(batch, istDate(at))) {
      throw new Error('That batch has closed or ended. Pick another one.');
    }
    if (!batch.trial_link) {
      throw new Error('That batch has no trial link yet. Add the link, then offer the seat.');
    }
    await tx.waitlistOffer.updateMany({
      where: { leadId, status: 'PENDING' },
      data: { status: 'CANCELLED', resolvedAt: at },
    });
    await createOffer(tx, lead, batch, at, actor);
  });
}

/**
 * A waitlisted lead wants to choose again: back to ASKING. A seat held for them goes back to the
 * queue, or it could book the old choice if they're waitlisted again.
 */
export async function leaveWaitlist(leadId: string, opts: { actor: Actor; note?: string }) {
  const at = await now();
  await db.$transaction(async (tx) => {
    await transition(leadId, 'ASKING', opts, tx);
    await tx.waitlistOffer.updateMany({
      where: { leadId, status: 'PENDING' },
      data: { status: 'CANCELLED', resolvedAt: at },
    });
    // Same as assignSeat: the waitlist follow-up staff were flagged for is over.
    await tx.lead.update({ where: { id: leadId }, data: { needsHuman: false } });
  });
}

type Waiting = { id: string; notes: string | null };

/** A link-less batch can't be booked by the bot, so tell staff once instead of offering it. */
async function alertStaffNoLink(tx: Tx, batch: LockedBatch, waiting: Waiting[], at: Date) {
  if (batch.waitlist_alerted_at) return 0;
  const note = `Waitlist: ${batch.name} is open but has no trial link. Add the link so it can be offered.`;
  for (const lead of waiting) {
    await tx.lead.update({
      where: { id: lead.id },
      data: { needsHuman: true, notes: [lead.notes, note].filter(Boolean).join('\n') },
    });
  }
  await tx.batch.update({ where: { id: batch.id }, data: { waitlistAlertedAt: at } });
  return waiting.length;
}

async function offerBatch(tx: Tx, batchId: string, at: Date) {
  const batch = await lockBatch(tx, batchId);
  if (batch.status !== 'OPEN' || !isLive(batch, istDate(at))) return { offered: 0, flagged: 0 };

  const waiting = await tx.lead.findMany({
    where: { ...WAITING, courseId: batch.course_id },
    orderBy: { createdAt: 'asc' },
    include: { waitlistOffers: { orderBy: { offeredAt: 'desc' }, take: 1 } },
  });
  if (!batch.trial_link) {
    return { offered: 0, flagged: await alertStaffNoLink(tx, batch, waiting, at) };
  }

  // ponytail: no limit on repeat offers, so a lead who ignores them gets one every 24 h until the
  // batch ends. Cap the offers per lead if WhatsApp block rates rise.
  const due = waiting.filter(
    (l) => at.getTime() - (l.waitlistOffers[0]?.offeredAt.getTime() ?? 0) >= OFFER_WINDOW_MS,
  );
  for (const lead of due) await createOffer(tx, lead, batch, at, 'cron');
  return { offered: due.length, flagged: 0 };
}

/**
 * Every 30 min: close offers that lapsed or can no longer be used, then offer each live batch to
 * the waitlisted leads on its course who haven't had an offer in 24 h (earliest batch first).
 */
export async function runWaitlistOffers() {
  const at = await now();
  const today = istDate(at);
  const { count: expired } = await db.waitlistOffer.updateMany({
    where: { status: 'PENDING', expiresAt: { lte: at } },
    data: { status: 'EXPIRED', resolvedAt: at },
  });
  const { count: cancelled } = await db.waitlistOffer.updateMany({
    where: {
      status: 'PENDING',
      OR: [
        { lead: { NOT: WAITING } },
        { batch: { OR: [{ status: 'CLOSED' }, { endDate: { lt: today } }] } },
      ],
    },
    data: { status: 'CANCELLED', resolvedAt: at },
  });

  const batches = await db.batch.findMany({
    where: {
      status: 'OPEN',
      endDate: { gte: today },
      course: { isActive: true, leads: { some: WAITING } },
    },
    orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
    select: { id: true },
  });
  const result = { expired, cancelled, offered: 0, flagged: 0, failed: [] as string[] };
  for (const { id } of batches) {
    try {
      const r = await db.$transaction((tx) => offerBatch(tx, id, at));
      result.offered += r.offered;
      result.flagged += r.flagged;
    } catch (e) {
      result.failed.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (result.flagged) await publishInboxChanged();
  return result;
}
