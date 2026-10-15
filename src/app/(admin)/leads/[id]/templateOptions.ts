import 'server-only';
import { formatDate, formatDays, formatMoney, formatTime } from '@/modules/core/utils';
import { firstName } from '@/modules/enrollments';
import type { LeadDetail } from '@/modules/leads';
import { TEMPLATES, type TemplateName, type TemplateOption } from '@/modules/messaging';

/**
 * The templates staff can send this lead right now, with variables filled from their data.
 * (View-model assembly across leads/enrollments/payments — lives with the page that needs it.)
 */
export function templateOptions(lead: LeadDetail): TemplateOption[] {
  const name = firstName(lead);
  const e = lead.enrollments[0];
  const live = e && (e.status === 'TRIAL' || e.status === 'PAID');
  const pay = e?.payments.find((p) => p.status === 'CREATED' && p.razorpayLinkUrl);
  const batchAnswer = lead.answers.find((a) => a.questionKey === 'batch');

  const vars: Partial<Record<TemplateName, Record<string, string>>> = {
    ...(live &&
      e.zoomJoinUrl && {
        class_reminder: {
          name,
          batch: e.batch.name,
          when: `${formatDays(e.batch.daysOfWeek)} at ${formatTime(e.batch.startTime)} IST`,
          joinUrl: e.zoomJoinUrl,
        },
      }),
    ...(pay && {
      trial_payment_reminder: {
        name,
        course: e.batch.course.name,
        trialEnd: formatDate(e.trialEnd),
        amount: formatMoney(pay.amountPaise),
        payUrl: pay.razorpayLinkUrl!,
      },
      trial_last_day: { name, payUrl: pay.razorpayLinkUrl! },
    }),
    ...(e?.status === 'PAID' &&
      e.zoomJoinUrl && {
        enrollment_confirmed: { name, batch: e.batch.name, joinUrl: e.zoomJoinUrl },
      }),
    ...(e?.status === 'EXPIRED' && { trial_ended: { name } }),
    ...(lead.status === 'WAITLISTED' &&
      batchAnswer && {
        waitlist_seat_open: { name, batch: batchAnswer.answerLabel },
      }),
  };

  return (Object.entries(vars) as [TemplateName, Record<string, string>][]).map(([t, v]) => ({
    name: t,
    vars: v,
    preview: TEMPLATES[t].preview(v as never),
  }));
}
