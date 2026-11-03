import 'server-only';
import { z } from 'zod';
import { config } from '../config';
import {
  checkButtons,
  checkList,
  checkTemplate,
  checkText,
  WhatsAppApiError,
  type SendResult,
  type WhatsAppClient,
} from './types';

// WhatsApp Cloud API. Enforces the same limits as the fake, then POSTs to Meta.
const MESSAGES_URL = `https://graph.facebook.com/v26.0/${config.WA_PHONE_NUMBER_ID}/messages`;
const TIMEOUT_MS = 10_000;

const graphResponse = z
  .object({
    messages: z.array(z.object({ id: z.string() })).optional(),
    error: z
      .object({
        code: z.number().optional(),
        message: z.string().optional(),
        error_user_title: z.string().optional(),
      })
      .optional(),
  })
  .catch({}); // Non-JSON or unexpected body (e.g. a gateway 502): reported by HTTP status below.

async function send(to: string, message: Record<string, unknown>): Promise<SendResult> {
  const res = await fetch(MESSAGES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.WA_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, ...message }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const { messages, error } = graphResponse.parse(await res.json().catch(() => null));
  const waMessageId = messages?.[0]?.id;
  if (res.ok && waMessageId) return { waMessageId };

  const title = (error?.error_user_title ?? error?.message ?? 'No details from Meta')
    .replace(/^\(#\d+\)\s*/, '') // Graph repeats the code: "(#131030) Recipient…"
    .replace(/\d{7,}/g, '***'); // This text is stored and logged: never a phone number or id.
  throw new WhatsAppApiError(`${error?.code ?? `HTTP ${res.status}`}: ${title}`);
}

export const liveWhatsApp: WhatsAppClient = {
  async sendText(to, text) {
    checkText(text);
    return send(to, { type: 'text', text: { body: text } });
  },
  async sendButtons(to, msg) {
    checkButtons(msg);
    return send(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: msg.body },
        action: { buttons: msg.buttons.map((reply) => ({ type: 'reply', reply })) },
      },
    });
  },
  async sendList(to, msg) {
    checkList(msg);
    return send(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: msg.body },
        action: { button: msg.button, sections: [{ rows: msg.rows }] },
      },
    });
  },
  async sendTemplate(to, name, lang, params) {
    checkTemplate(name, lang);
    return send(to, {
      type: 'template',
      template: {
        name,
        language: { code: lang },
        // Meta rejects an empty parameter list, so templates without params send no components.
        ...(params.length && {
          components: [
            { type: 'body', parameters: params.map((text) => ({ type: 'text', text })) },
          ],
        }),
      },
    });
  },
};
