import 'server-only';
import type { Lead } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { db } from '@/lib/db';
import { assignSeat } from '@/modules/enrollments';
import { canTransition, transition, upsertLead } from '@/modules/leads';
import {
  hasMessage,
  recordInbound,
  sendText,
  type InboundMessage,
  type MessageBody,
} from '@/modules/messaging';
import { getSetting } from '@/modules/settings';
import type { AskOptions, BotStep, StepContext, StepKey } from '../types';
import { handOver, isUuid, replyOf } from './shared';
import { batchStep } from './steps/batch';
import { confirmStep } from './steps/confirm';
import { courseStep } from './steps/course';
import { nameStep } from './steps/name';

const STEPS: Record<StepKey, BotStep> = {
  name: nameStep,
  course: courseStep,
  batch: batchStep,
  confirm: confirmStep,
};

/** The active questions in order — the bot script admins edit. */
const loadScript = () =>
  db.question.findMany({
    where: { isActive: true, key: { in: Object.keys(STEPS) } },
    include: { options: true },
    orderBy: { step: 'asc' },
  });
type Script = Awaited<ReturnType<typeof loadScript>>;

const reload = (leadId: string) => db.lead.findUniqueOrThrow({ where: { id: leadId } });

/**
 * Entry point for every inbound WhatsApp message (from the processWebhook job):
 * dedupe → upsert lead → log message → keywords → route by status / current step.
 */
export async function handleInbound(msg: InboundMessage): Promise<void> {
  if (await hasMessage(msg.messageId)) return;
  const lead = await upsertLead(msg, await now());
  if (!(await recordInbound(lead.id, msg))) return; // a parallel delivery got here first
  if (lead.optedOutAt) return; // keep the log, never reply

  if (await handleKeyword(lead, msg)) return;

  switch (lead.status) {
    case 'NEW':
      await transition(lead.id, 'ASKING', { actor: 'bot' });
      return startScript(await reload(lead.id), { prefix: await getSetting('welcome_text') });
    case 'DROPPED':
      // They came back: resume where they stopped, treating this message as the answer.
      await transition(lead.id, 'ASKING', { actor: 'bot', note: 'Lead replied' });
      return answerStep(await reload(lead.id), msg);
    case 'ASKING':
      return answerStep(lead, msg);
    case 'WAITLISTED':
      return waitlisted(lead, msg);
    default:
      return contextualReply(lead, msg);
  }
}

// ─── Keywords ────────────────────────────────────────────────────────────────

async function handleKeyword(lead: Lead, msg: InboundMessage): Promise<boolean> {
  const word = msg.kind === 'text' ? (msg.text ?? '').trim().toUpperCase() : '';

  if (word === 'STOP') {
    await sendText(lead.id, "You've been unsubscribed and won't get any more messages from us.", {
      sentBy: 'bot',
    });
    if (canTransition(lead.status, 'OPTED_OUT')) {
      await transition(lead.id, 'OPTED_OUT', { actor: 'bot', note: 'Sent STOP' });
    } else {
      // Mid-trial/enrolled: honour the opt-out for messaging; staff decide about the enrollment.
      await db.lead.update({
        where: { id: lead.id },
        data: { optedOutAt: new Date(), needsHuman: true },
      });
    }
    return true;
  }
  if (word === 'HELP' || word === 'AGENT') {
    await handOver(lead);
    return true;
  }
  if (word === 'RESTART' && ['NEW', 'ASKING', 'DROPPED'].includes(lead.status)) {
    if (lead.status !== 'ASKING')
      await transition(lead.id, 'ASKING', { actor: 'bot', note: 'RESTART' });
    await startScript(await reload(lead.id), { prefix: 'No problem, let’s start again.' });
    return true;
  }
  return false;
}

// ─── Question flow ───────────────────────────────────────────────────────────

async function askQuestion(lead: Lead, question: Script[number], opts?: AskOptions) {
  await db.lead.update({ where: { id: lead.id }, data: { currentStep: question.step } });
  const ctx: StepContext = { lead: { ...lead, currentStep: question.step }, question };
  await STEPS[question.key as StepKey].ask(ctx, opts);
}

async function startScript(lead: Lead, opts?: AskOptions) {
  const script = await loadScript();
  if (!script.length) return handOver(lead);
  await askQuestion(lead, script[0], opts);
}

/** Re-ask the lead's current question (nudges). */
export async function reaskCurrent(lead: Lead, opts: AskOptions) {
  const script = await loadScript();
  const question = script.find((q) => q.step === lead.currentStep) ?? script[0];
  if (question) await askQuestion(lead, question, opts);
}

async function answerStep(lead: Lead, msg: InboundMessage) {
  const script = await loadScript();
  const question = script.find((q) => q.step === lead.currentStep) ?? script[0];
  if (!question) return handOver(lead);

  const res = await STEPS[question.key as StepKey].handle({ lead, question }, msg);
  const fresh = await reload(lead.id);

  switch (res.result) {
    case 'next': {
      const next = script.find((q) => q.step > question.step);
      return next ? askQuestion(fresh, next) : finishScript(fresh);
    }
    case 'goto': {
      const target = script.find((q) => q.key === res.step);
      return target ? askQuestion(fresh, target) : handOver(fresh);
    }
    case 'retry': {
      // Second invalid answer in a row to the same question → a human takes over.
      const lastOut = await db.message.findFirst({
        where: { leadId: lead.id, direction: 'OUT' },
        orderBy: { createdAt: 'desc' },
      });
      if ((lastOut?.body as MessageBody | null)?.retryStep === question.step)
        return handOver(fresh);
      return askQuestion(fresh, question, { prefix: res.reason, retry: true });
    }
    case 'done':
      return;
  }
}

/** All questions answered: QUALIFIED → book the seat (trial link follows via the zoomRegister job). */
async function finishScript(lead: Lead) {
  await db.lead.update({ where: { id: lead.id }, data: { currentStep: null } });
  const batch = await db.answer.findUnique({
    where: { leadId_questionKey: { leadId: lead.id, questionKey: 'batch' } },
  });
  if (!isUuid(batch?.answerValue)) return handOver(lead);

  await transition(lead.id, 'QUALIFIED', { actor: 'bot' });
  const result = await assignSeat(lead.id, batch.answerValue, { actor: 'bot' });
  if (result.result === 'waitlisted') {
    await sendText(
      lead.id,
      `Sorry, ${batch.answerLabel} filled up just now. You're on the waitlist — we'll message you here as soon as a seat opens.`,
      { sentBy: 'bot' },
    );
  } else {
    await sendText(lead.id, 'Great, your seat is booked! Your personal class link is on its way.', {
      sentBy: 'bot',
    });
  }
}

// ─── Other statuses ──────────────────────────────────────────────────────────

/** A waitlisted lead replying "yes" / tapping "Book my seat" gets the seat if one is free. */
async function waitlisted(lead: Lead, msg: InboundMessage) {
  const wantsSeat = ['book_seat', 'yes', 'y', 'book'].includes(replyOf(msg));
  if (!wantsSeat) return handOver(lead);

  const batch = await db.answer.findUnique({
    where: { leadId_questionKey: { leadId: lead.id, questionKey: 'batch' } },
  });
  if (!isUuid(batch?.answerValue)) return handOver(lead);
  const result = await assignSeat(lead.id, batch.answerValue, { actor: 'bot' });
  await sendText(
    lead.id,
    result.result === 'trial'
      ? 'Great, your seat is booked! Your personal class link is on its way.'
      : `Sorry, ${batch.answerLabel} is still full. We'll message you as soon as a seat opens.`,
    { sentBy: 'bot' },
  );
}

/** Trial/paid/expired leads: answer "link?"-type questions, hand everything else to staff. */
async function contextualReply(lead: Lead, msg: InboundMessage) {
  const asksForLink = /link|zoom|join|class|pay/i.test(msg.text ?? '');
  const enrollment = await db.enrollment.findFirst({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    include: {
      payments: {
        where: { status: 'CREATED', method: 'RAZORPAY' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });
  const joinUrl = enrollment?.zoomJoinUrl;
  const payUrl = enrollment?.payments[0]?.razorpayLinkUrl;
  const reply =
    lead.status === 'TRIAL_ACTIVE' || lead.status === 'ENROLLED'
      ? joinUrl && `Your class link: ${joinUrl}`
      : lead.status === 'PAYMENT_PENDING'
        ? payUrl &&
          `Your payment link: ${payUrl}${joinUrl ? `\n\nYour class link: ${joinUrl}` : ''}`
        : lead.status === 'EXPIRED'
          ? payUrl && `Your trial has ended. Pay here to join the batch: ${payUrl}`
          : null;

  if (asksForLink && reply) {
    await sendText(lead.id, reply, { sentBy: 'bot' });
  } else {
    await handOver(lead);
  }
}
