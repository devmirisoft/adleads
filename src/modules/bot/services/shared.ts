import 'server-only';
import { db } from '@/lib/db';
import { publishInboxChanged } from '@/lib/realtime/client';
import { sendText, type MessageBody } from '@/modules/messaging';
import type { AskOptions, StepContext } from '../types';

/** Postgres rejects non-UUID text in uuid columns, so check user-supplied ids before querying. */
export const isUuid = (s: string | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const truncate = (s: string, max: number) =>
  s.length > max ? `${s.slice(0, max - 1)}…` : s;

export const withPrefix = (prompt: string, prefix?: string) =>
  prefix ? `${prefix}\n\n${prompt}` : prompt;

export const sendOptions = (ctx: StepContext, opts: AskOptions = {}) => ({
  sentBy: opts.sentBy ?? 'bot',
  retryStep: opts.retry ? ctx.question.step : undefined,
});

export async function saveAnswer(
  leadId: string,
  questionKey: string,
  value: string,
  label: string,
) {
  await db.answer.upsert({
    where: { leadId_questionKey: { leadId, questionKey } },
    create: { leadId, questionKey, answerValue: value, answerLabel: label },
    update: { answerValue: value, answerLabel: label, answeredAt: new Date() },
  });
}

/** Until a seat is booked the lead can go back and choose again (the CHANGE keyword in the engine). */
export const CHANGE_HINT = 'Reply CHANGE to pick a different course or batch.';

/** What a lead hears when there's nothing to book. Promises only what staff will actually do. */
export const noSeats = (where: string) =>
  `There are currently no available seats in ${where}. Our team will follow up with you.\n\n${CHANGE_HINT}`;

const HANDED_OVER = 'Thanks for your message! Someone from our team will reply here soon.';
/** Senders that aren't a person on the team. */
const SYSTEM = ['bot', 'cron', 'webhook'];

/**
 * Hand the chat to staff: flag it and tell the lead. Quiet only when that's already the last thing
 * we said (a burst of messages gets one reply) or a team member wrote last (don't talk over them).
 */
export async function handOver(lead: { id: string; needsHuman: boolean }, text = HANDED_OVER) {
  if (!lead.needsHuman) {
    await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });
  }
  const last = await db.message.findFirst({
    where: { leadId: lead.id, direction: 'OUT' },
    orderBy: { createdAt: 'desc' },
    select: { body: true, sentBy: true },
  });
  if (last && (!SYSTEM.includes(last.sentBy) || (last.body as MessageBody | null)?.text === text)) {
    if (!lead.needsHuman) await publishInboxChanged(); // the new flag; a send would publish it
    return;
  }
  await sendText(lead.id, text, { sentBy: 'bot' });
}
