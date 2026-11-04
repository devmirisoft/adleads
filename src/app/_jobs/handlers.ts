import 'server-only';
import { after } from 'next/server';
import { z } from 'zod';
import { handleInbound } from '@/modules/bot';
import { sendNewLink, sendTrialLink } from '@/modules/enrollments';
import {
  getWebhookEvent,
  markWebhookNoted,
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
import { handleRazorpayEvent } from '@/modules/payments';

// Composition root: job type → feature module. Lives in the app layer so the jobs module
// stays generic and no module has to import bot/payments/enrollments sideways.

const id = z.object({ enrollmentId: z.uuid() });
const newLink = z.object({ enrollmentId: z.uuid(), link: z.enum(['trial', 'paid']) });

/** Rows queued before the Zoom API was removed: there is nothing left to do for them. */
const retiredZoomJob = async () => 'Skipped: the Zoom API was removed';

/** Returns a note if anything was ignored. Only real failures throw, and those retry. */
async function processMetaEvent(payload: unknown): Promise<string | undefined> {
  let parsed: ReturnType<typeof parseMetaWebhook>;
  try {
    parsed = parseMetaWebhook(payload);
  } catch {
    return 'Not a WhatsApp Business webhook';
  }
  // One failure must not hold back the rest of the batch. Retrying the whole event is safe:
  // messages dedupe on wa_message_id and statuses only move forward.
  const failures: unknown[] = [];
  for (const m of parsed.messages) await handleInbound(m).catch((e) => failures.push(e));
  for (const s of parsed.statuses) await applyStatus(s).catch((e) => failures.push(e));
  if (failures.length) throw failures[0];
  return parsed.notes.join('; ') || undefined;
}

export const jobHandlers: JobHandlers = {
  async processWebhook(payload) {
    const { webhookEventId } = z.object({ webhookEventId: z.string() }).parse(payload);
    const event = await getWebhookEvent(webhookEventId);
    if (event.processedAt) return;
    try {
      if (event.provider === 'META') {
        const note = await processMetaEvent(event.payload);
        if (note) return await markWebhookNoted(webhookEventId, note);
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
    const link = newLink.safeParse(payload);
    if (link.success) return sendNewLink(link.data.enrollmentId, link.data.link);

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

  async sendTrialLink(payload) {
    await sendTrialLink(id.parse(payload).enrollmentId, { once: true });
  },

  zoomRegister: retiredZoomJob,
  zoomCancel: retiredZoomJob,
};

/** Run due jobs straight after the response, so what was just queued doesn't wait for the cron tick. */
export function runJobsAfterResponse() {
  after(async () => {
    try {
      await runDue(jobHandlers, 50);
    } catch (e) {
      console.error('[jobs] runDue failed', e);
    }
  });
}

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
