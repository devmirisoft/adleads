import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import type { LinkKind } from '@/modules/core/types';
import { formatDate, formatDays, formatTime } from '@/modules/core/utils';
import { enqueue } from '@/modules/jobs';
import { OutsideWindowError, sendTemplate, sendText } from '@/modules/messaging';
import { getMessage } from '@/modules/settings';

export const firstName = (lead: { name: string | null; profileName: string | null }) =>
  (lead.name ?? lead.profileName ?? 'there').split(' ')[0];

/** Staff pasted it, so it's real in any mode, and the bot may book this batch on its own. */
export const trialLinkAvailable = (batch: { trialLink: string | null }) => !!batch.trialLink;

const STAGE = { trial: 'TRIAL', paid: 'PAID' } as const;

const withLeadAndBatch = { lead: true, batch: true } satisfies Prisma.EnrollmentInclude;
type Loaded = Prisma.EnrollmentGetPayload<{ include: typeof withLeadAndBatch }>;

const load = (id: string) =>
  db.enrollment.findUniqueOrThrow({ where: { id }, include: withLeadAndBatch });

const classTime = (b: Loaded['batch']) =>
  `${formatDays(b.daysOfWeek)} at ${formatTime(b.startTime)} IST`;

/** Call once a link has really gone out. */
export const recordLinkSent = (enrollmentId: string, link: string) =>
  db.enrollment.update({
    where: { id: enrollmentId },
    data: { zoomJoinUrl: link, linkSentAt: new Date() },
  });

/**
 * Free text inside the 24 h window, otherwise this stage's template. Stores the link actually
 * sent: an opted-out lead gets nothing, so nothing is stored.
 */
async function deliverLink(e: Loaded, link: string, text: string) {
  const name = firstName(e.lead);
  const batch = e.batch.name;
  const opts = { sentBy: 'bot' };
  const sent = await sendText(e.leadId, text, opts).catch((err: unknown) => {
    if (!(err instanceof OutsideWindowError)) throw err;
    return e.status === 'TRIAL'
      ? sendTemplate(
          e.leadId,
          'class_reminder',
          { name, batch, when: classTime(e.batch), joinUrl: link },
          opts,
        )
      : sendTemplate(e.leadId, 'enrollment_confirmed', { name, batch, joinUrl: link }, opts);
  });
  if (sent) await recordLinkSent(e.id, link);
}

/**
 * Send the batch's link for this stage: trial link while on trial, paid link once paid.
 * `once` (job `sendTrialLink`) skips a link that already went out, so a re-run doesn't message twice.
 * assignSeat and moveBatch clear linkSentAt when a new link is due. Without it: "Resend class link".
 */
export async function sendTrialLink(enrollmentId: string, { once = false } = {}) {
  const e = await load(enrollmentId);
  if (e.status !== 'TRIAL' && e.status !== 'PAID') return; // cancelled/expired meanwhile
  if (once && e.linkSentAt) return;

  const onTrial = e.status === 'TRIAL';
  const link = onTrial ? e.batch.trialLink : e.batch.paidLink;
  // Staff see this on "Resend class link"; as a job it retries, then flags the lead for staff.
  if (!link) {
    throw new Error(
      `${e.batch.name} has no ${onTrial ? 'trial' : 'paid'} link yet, so nothing was sent. Add it on the batch page, then use "Resend class link".`,
    );
  }

  const vars = { name: firstName(e.lead), batch: e.batch.name, when: classTime(e.batch), link };
  const text = onTrial
    ? await getMessage('msg_trial_link', {
        ...vars,
        trial_start: formatDate(e.trialStart),
        trial_end: formatDate(e.trialEnd),
      })
    : await getMessage('msg_paid_link', vars);
  await deliverLink(e, link, text);
  if (onTrial && !e.linkSentAt) await sendInvite(e);
}

/**
 * wa.me/?text= opens WhatsApp's contact picker with a ready message. Its link opens a chat with us,
 * pre-filled with who invited them, so staff see the referrer in the friend's first message.
 */
export function inviteLink(businessNumber: string, inviter: string) {
  const join = `https://wa.me/${businessNumber}?text=${encodeURIComponent(
    `Hi, ${inviter} invited me. I'd like to join a free trial`,
  )}`;
  return `https://wa.me/?text=${encodeURIComponent(
    `${inviter} invited you to a free trial class! Tap to book yours: ${join}`,
  )}`;
}

/**
 * "Invite a friend", after the first trial link (a batch move counts as a new first link). Best
 * effort: the link already went out, so a failure here must not fail or retry that job. Free text
 * only: outside the 24 h window there's no template for it, so it's skipped. A failed send still
 * shows as FAILED in the chat (send.ts).
 */
async function sendInvite(e: Loaded) {
  if (!config.WA_DISPLAY_NUMBER) return;
  const name = firstName(e.lead);
  try {
    const text = await getMessage('msg_invite', {
      name,
      link: inviteLink(config.WA_DISPLAY_NUMBER, name),
    });
    await sendText(e.leadId, text, { sentBy: 'bot' });
  } catch (err) {
    if (!(err instanceof OutsideWindowError)) {
      console.error('[invite] send failed', err instanceof Error ? err.name : 'unknown');
    }
  }
}

/** "Send the new link" after staff changed a batch's link. Returns how many sends were queued. */
export async function queueNewLink(batchId: string, kind: LinkKind): Promise<number> {
  const recipients = await db.enrollment.findMany({
    where: { batchId, status: STAGE[kind], lead: { optedOutAt: null } },
    select: { id: true, leadId: true },
  });
  // Not one transaction: a big batch would outrun its timeout, and a retry can't double-send.
  for (const r of recipients) {
    await enqueue('sendMessage', { leadId: r.leadId, enrollmentId: r.id, link: kind });
  }
  return recipients.length;
}

/**
 * Job `sendMessage` from queueNewLink. Reads everything fresh: by now the enrollment may have paid
 * or expired, or already hold this link, so a re-run or a second confirm doesn't message twice.
 */
export async function sendNewLink(enrollmentId: string, kind: LinkKind) {
  const e = await load(enrollmentId);
  const link = kind === 'trial' ? e.batch.trialLink : e.batch.paidLink;
  if (e.status !== STAGE[kind] || !link || e.zoomJoinUrl === link) return;
  await deliverLink(
    e,
    link,
    await getMessage('msg_link_changed', { name: firstName(e.lead), batch: e.batch.name, link }),
  );
}
