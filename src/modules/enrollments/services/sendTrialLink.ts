import 'server-only';
import { db } from '@/lib/db';
import { zoom } from '@/lib/zoom/client';
import { formatDate, formatDays, formatTime } from '@/modules/core/utils';
import { OutsideWindowError, sendTemplate, sendText } from '@/modules/messaging';

// ponytail: Zoom requires an email per registrant and the bot doesn't ask for one; a placeholder
// per phone number works with registration emails turned off. Ask for email in the bot if Zoom mails matter.
const placeholderEmail = (phoneE164: string) => `wa${phoneE164.slice(1)}@example.com`;

export const firstName = (lead: { name: string | null; profileName: string | null }) =>
  (lead.name ?? lead.profileName ?? 'there').split(' ')[0];

/** Registers the lead on the batch's Zoom meeting unless already registered. Returns their join URL. */
export async function ensureRegistered(enrollmentId: string): Promise<string> {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: true, batch: true },
  });
  if (e.zoomRegistrantId && e.zoomJoinUrl) return e.zoomJoinUrl;
  if (!e.batch.zoomMeetingId) throw new Error(`Batch "${e.batch.name}" has no Zoom meeting yet.`);

  const [first, ...rest] = (e.lead.name ?? e.lead.profileName ?? 'Student').split(' ');
  const { registrantId, joinUrl } = await zoom.addRegistrant(e.batch.zoomMeetingId, {
    firstName: first,
    lastName: rest.join(' '),
    email: placeholderEmail(e.lead.phoneE164),
  });
  await db.enrollment.update({
    where: { id: enrollmentId },
    data: { zoomRegistrantId: registrantId, zoomJoinUrl: joinUrl },
  });
  return joinUrl;
}

/** Job `zoomRegister`: register on Zoom, then send the personal trial link (template if outside 24 h). */
export async function sendTrialLink(enrollmentId: string) {
  const e = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { lead: true, batch: true },
  });
  if (e.status !== 'TRIAL' && e.status !== 'PAID') return; // cancelled/expired meanwhile

  const joinUrl = await ensureRegistered(enrollmentId);
  const name = firstName(e.lead);
  const when = `${formatDays(e.batch.daysOfWeek)} at ${formatTime(e.batch.startTime)} IST`;
  const text =
    e.status === 'TRIAL'
      ? `You're booked, ${name}! Your free trial of ${e.batch.name} (${when}) runs ${formatDate(e.trialStart)} – ${formatDate(e.trialEnd)}.\n\nJoin with your personal link: ${joinUrl}\n\nThis link works only for you — please don't share it.`
      : `Here's your class link for ${e.batch.name} (${when}): ${joinUrl}`;
  try {
    await sendText(e.leadId, text, { sentBy: 'bot' });
  } catch (err) {
    if (!(err instanceof OutsideWindowError)) throw err;
    await sendTemplate(
      e.leadId,
      'class_reminder',
      { name, batch: e.batch.name, when, joinUrl },
      { sentBy: 'bot' },
    );
  }
  await db.enrollment.update({ where: { id: enrollmentId }, data: { linkSentAt: new Date() } });
}

/** Job `zoomCancel` (old registrant after a batch move). */
export async function cancelRegistrant(meetingId: bigint, registrantId: string) {
  await zoom.cancelRegistrant(meetingId, registrantId);
}
