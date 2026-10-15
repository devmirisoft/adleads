import 'server-only';
import { z } from 'zod';
import { handleInbound } from '@/modules/bot';
import { cancelRegistrant, sendTrialLink } from '@/modules/enrollments';
import {
  getWebhookEvent,
  markWebhookProcessed,
  runDue,
  type JobHandlers,
  type RunResult,
} from '@/modules/jobs';
import {
  applyStatus,
  parseMetaWebhook,
  sendTemplate,
  TEMPLATE_NAMES,
  type TemplateName,
} from '@/modules/messaging';
import { handleRazorpayEvent, requestPayment } from '@/modules/payments';

// Composition root: job type → feature module. Lives in the app layer so the jobs module
// stays generic and no module has to import bot/payments/enrollments sideways.

const id = z.object({ enrollmentId: z.uuid() });

export const jobHandlers: JobHandlers = {
  async processWebhook(payload) {
    const { webhookEventId } = z.object({ webhookEventId: z.string() }).parse(payload);
    const event = await getWebhookEvent(webhookEventId);
    if (event.processedAt) return;
    try {
      if (event.provider === 'META') {
        const { messages, statuses } = parseMetaWebhook(event.payload);
        for (const m of messages) await handleInbound(m); // each dedupes on wa_message_id
        for (const s of statuses) await applyStatus(s);
      } else if (event.provider === 'RAZORPAY') {
        await handleRazorpayEvent(event.payload);
      }
      await markWebhookProcessed(webhookEventId);
    } catch (e) {
      await markWebhookProcessed(webhookEventId, e instanceof Error ? e.message : String(e));
      throw e;
    }
  },

  async sendMessage(payload) {
    const p = z
      .object({
        leadId: z.uuid(),
        template: z.enum(TEMPLATE_NAMES as [TemplateName, ...TemplateName[]]),
        vars: z.record(z.string(), z.string()),
        sentBy: z.string().default('cron'),
      })
      .parse(payload);
    // sendTemplate validates `vars` against the template's own schema.
    await sendTemplate(p.leadId, p.template, p.vars as never, { sentBy: p.sentBy });
  },

  async zoomRegister(payload) {
    await sendTrialLink(id.parse(payload).enrollmentId);
  },

  async zoomCancel(payload) {
    const p = z.object({ meetingId: z.string(), registrantId: z.string() }).parse(payload);
    await cancelRegistrant(BigInt(p.meetingId), p.registrantId);
  },

  async createPaymentLink(payload) {
    await requestPayment(id.parse(payload).enrollmentId, { actor: 'cron' });
  },
};

/** Dev only: run due jobs until the queue is idle (jobs can enqueue more jobs). */
export async function runJobsNow(maxRounds = 5): Promise<RunResult> {
  const total: RunResult = { done: 0, failed: [] };
  for (let i = 0; i < maxRounds; i++) {
    const r = await runDue(jobHandlers);
    total.done += r.done;
    total.failed.push(...r.failed);
    if (r.done + r.failed.length === 0) break;
  }
  return total;
}
