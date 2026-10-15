import 'server-only';
import { db } from '@/lib/db';
import { sendText } from '@/modules/messaging';
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

/** Hand the chat to staff: flag once and tell the lead (only when the flag flips, to avoid spam). */
export async function handOver(lead: { id: string; needsHuman: boolean }) {
  if (lead.needsHuman) return;
  await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });
  await sendText(lead.id, 'Thanks for your message! Someone from our team will reply here soon.', {
    sentBy: 'bot',
  });
}

/** Lowercased typed text or tapped id, for matching replies. */
export const replyOf = (msg: { text?: string; replyId?: string }) =>
  (msg.replyId ?? msg.text ?? '').trim().toLowerCase();
