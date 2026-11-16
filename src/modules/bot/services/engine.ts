import 'server-only';
import type { Lead } from '@/generated/prisma/client';
import { now } from '@/lib/clock';
import { paymentLinksAreFake } from '@/lib/config';
import { db } from '@/lib/db';
import { publishInboxChanged } from '@/lib/realtime/client';
import {
  assignSeat,
  currentOffer,
  firstName,
  leaveWaitlist,
  trialLinkAvailable,
  type AssignResult,
} from '@/modules/enrollments';
import { canTransition, transition, upsertLead } from '@/modules/leads';
import {
  hasMessage,
  recordInbound,
  sendText,
  showTyping,
  type InboundMessage,
  type MessageBody,
} from '@/modules/messaging';
import { getMessage } from '@/modules/settings';
import type { AskOptions, BotStep, StepContext, StepKey } from '../types';
import { replyOf } from '../utils';
import { CHANGE_HINT, handOver, isUuid } from './shared';
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
// ponytail: a process killed after logging the message leaves it unanswered, and the re-run stops at
// the dedupe. It shows as unread in /inbox and nudges re-ask ASKING leads. Log and reply atomically if that bites.
export async function handleInbound(msg: InboundMessage): Promise<void> {
  if (await hasMessage(msg.messageId)) return;
  const lead = await upsertLead(msg, await now());
  if (!(await recordInbound(lead.id, msg))) return; // a parallel delivery got here first
  if (lead.optedOutAt) return; // keep the log, never reply

  // Not once staff have the chat: the bot mostly stays quiet then, and Meta says to show it only
  // before a reply. Awaited, not fired alongside: landing after the reply, it would linger for 25 s.
  if (!lead.needsHuman) await showTyping(lead.id);
  if (await handleKeyword(lead, msg)) return;

  switch (lead.status) {
    case 'NEW':
      await transition(lead.id, 'ASKING', { actor: 'bot' });
      return startScript(await reload(lead.id), { prefix: await getMessage('welcome_text') });
    case 'DROPPED':
      // They came back: resume where they stopped, treating this message as the answer.
      await transition(lead.id, 'ASKING', { actor: 'bot', note: 'Lead replied' });
      return answerStep(await reload(lead.id), msg);
    case 'ASKING':
      return answerStep(lead, msg);
    case 'WAITLISTED':
      return waitlisted(lead, msg);
    case 'QUALIFIED':
      return handOver(lead, await getMessage('msg_link_coming'));
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
    await publishInboxChanged(); // an opt-out or a new flag, after the goodbye already published
    return true;
  }
  if (word === 'HELP' || word === 'AGENT') {
    await handOver(lead);
    return true;
  }
  const back = GO_BACK[word];
  if (back && CAN_GO_BACK.includes(lead.status)) {
    await goBack(lead, back, word);
    return true;
  }
  return false;
}

/** Typed words that take the lead back to a question. */
const GO_BACK: Partial<Record<string, StepKey>> = {
  RESTART: 'name',
  'CHANGE NAME': 'name',
  CHANGE: 'course',
  'CHANGE COURSE': 'course',
  'CHANGE BATCH': 'batch',
};
/** Nothing booked yet: the lead can still change their answers. */
const CAN_GO_BACK: Lead['status'][] = ['NEW', 'ASKING', 'DROPPED', 'QUALIFIED', 'WAITLISTED'];

async function goBack(lead: Lead, step: StepKey, word: string) {
  const opts = { actor: 'bot', note: `Sent ${word}` };
  if (lead.status === 'WAITLISTED') await leaveWaitlist(lead.id, opts);
  else if (lead.status !== 'ASKING') await transition(lead.id, 'ASKING', opts);

  // Earlier answers first: no batch list without a course, no course without a name.
  const key = step === 'batch' && !lead.courseId ? 'course' : step;
  const script = await loadScript();
  const question =
    script.find((q) => q.key === (key === 'course' && !lead.name ? 'name' : key)) ?? script[0];
  if (!question) return handOver(lead);
  await askQuestion(await reload(lead.id), question, {
    prefix: word === 'RESTART' ? 'No problem, let’s start again.' : 'No problem, let’s change that.',
  });
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
      // Never give up mid-script: re-ask with the hint. From the 2nd miss in a row it offers HELP;
      // from the 3rd, staff are flagged quietly so a stuck lead shows up in the inbox.
      const recent = await db.message.findMany({
        where: { leadId: lead.id, direction: 'OUT' },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { body: true },
      });
      const streak = recent.findIndex(
        (m) => (m.body as MessageBody | null)?.retryStep !== question.step,
      );
      const misses = 1 + (streak === -1 ? recent.length : streak); // this one included
      if (misses >= 3 && !fresh.needsHuman) {
        // No message to the lead; the re-ask below publishes the inbox change.
        await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });
      }
      return askQuestion(fresh, question, {
        prefix: misses >= 2 ? `${res.reason}\n\n${await getMessage('msg_stuck')}` : res.reason,
        retry: true,
      });
    }
    case 'done':
      return;
  }
}

async function canBook(batchId: string) {
  const batch = await db.batch.findUnique({ where: { id: batchId }, select: { trialLink: true } });
  return !!batch && trialLinkAvailable(batch);
}

/** All questions answered: QUALIFIED → book the seat (trial link follows via the sendTrialLink job). */
async function finishScript(lead: Lead) {
  await db.lead.update({ where: { id: lead.id }, data: { currentStep: null } });
  const batch = await db.answer.findUnique({
    where: { leadId_questionKey: { leadId: lead.id, questionKey: 'batch' } },
  });
  if (!isUuid(batch?.answerValue)) return handOver(lead);

  await transition(lead.id, 'QUALIFIED', { actor: 'bot' });
  // No trial link on the batch yet: no seat and no trial clock. Staff add the link and book.
  if (!(await canBook(batch.answerValue))) {
    return handOver(lead, await getMessage('msg_link_coming'));
  }
  const result = await assignSeat(lead.id, batch.answerValue, { actor: 'bot' });
  await replyToBooking(lead, result, batch.answerLabel);
}

/** Booked, no seat, or the lead already had their one free trial (the chat goes to staff). */
async function replyToBooking(lead: Lead, result: AssignResult, batch: string) {
  if (result.result === 'trialUsed') return handOver(lead, await getMessage('msg_trial_used'));
  const text =
    result.result === 'trial'
      ? await getMessage('msg_seat_booked', { name: firstName(lead), batch })
      : await getMessage('msg_no_seats', { where: batch });
  await sendText(lead.id, text, { sentBy: 'bot' });
}

// ─── Other statuses ──────────────────────────────────────────────────────────

/**
 * A waitlisted lead replying "yes" / tapping "Book my seat" books the seat offered to them. Only an
 * open offer can be booked, so a late or typed reply can't jump the queue or use an old batch answer.
 */
async function waitlisted(lead: Lead, msg: InboundMessage) {
  const wantsSeat = ['book_seat', 'yes', 'y', 'book'].includes(replyOf(msg));
  if (!wantsSeat) return handOver(lead, await getMessage('msg_waitlist'));

  const offer = await currentOffer(lead.id);
  if (!offer) {
    await db.lead.update({ where: { id: lead.id }, data: { needsHuman: true } });
    await sendText(
      lead.id,
      `Sorry, we don't have a seat held for you right now. Our team will follow up with you.\n\n${CHANGE_HINT}`,
      { sentBy: 'bot' },
    );
    return;
  }
  if (!(await canBook(offer.batchId))) return handOver(lead, await getMessage('msg_link_coming'));
  const result = await assignSeat(lead.id, offer.batchId, { actor: 'bot' });
  await replyToBooking(lead, result, offer.batch.name);
}

/** Trial/paid/expired leads: answer "link?"-type questions, hand everything else to staff. */
async function contextualReply(lead: Lead, msg: InboundMessage) {
  const asksForLink = /link|zoom|join|class|pay/i.test(msg.text ?? '');
  const asksToPay = /pay/i.test(msg.text ?? '');
  const noPaymentLinks = paymentLinksAreFake();
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
  // The stored link is the one for their stage: markPaid and expire clear it when the stage changes.
  const classLink = enrollment?.zoomJoinUrl && `Your class link: ${enrollment.zoomJoinUrl}`;
  const payUrl = noPaymentLinks ? null : enrollment?.payments[0]?.razorpayLinkUrl;
  const reply =
    lead.status === 'TRIAL_ACTIVE' || lead.status === 'ENROLLED'
      ? classLink
      : lead.status === 'PAYMENT_PENDING'
        ? payUrl
          ? `Your payment link: ${payUrl}${classLink ? `\n\n${classLink}` : ''}`
          : classLink
        : lead.status === 'EXPIRED'
          ? payUrl && `Your trial has ended. Pay here to join the batch: ${payUrl}`
          : null;

  if (asksForLink && reply && !(asksToPay && noPaymentLinks)) {
    await sendText(lead.id, reply, { sentBy: 'bot' });
  } else {
    await handOver(lead);
  }
}
