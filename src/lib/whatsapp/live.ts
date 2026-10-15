import 'server-only';
import type { WhatsAppClient } from './types';

// TODO(live): WhatsApp Cloud API, using config.WA_PHONE_NUMBER_ID + config.WA_ACCESS_TOKEN.
//  - Every send: POST https://graph.facebook.com/v21.0/{WA_PHONE_NUMBER_ID}/messages
//    headers: Authorization: Bearer {WA_ACCESS_TOKEN}; body { messaging_product: "whatsapp", to, … }
//  - sendText:     type "text", text: { body }
//  - sendButtons:  type "interactive", interactive: { type: "button", body: { text }, action: { buttons: [{ type: "reply", reply: { id, title } }] } }
//  - sendList:     type "interactive", interactive: { type: "list", body: { text }, action: { button, sections: [{ rows }] } }
//  - sendTemplate: type "template", template: { name, language: { code: lang }, components: [{ type: "body", parameters: [{ type: "text", text }] }] }
//  - Call the check* functions from ./types first; return { waMessageId: response.messages[0].id }.
//  - Map Graph API errors (e.g. 131047 re-engagement window, 131026 undeliverable) to thrown Errors with the code.
const notImplemented = (): never => {
  throw new Error('Not implemented: live WhatsApp adapter');
};

export const liveWhatsApp: WhatsAppClient = {
  sendText: notImplemented,
  sendButtons: notImplemented,
  sendList: notImplemented,
  sendTemplate: notImplemented,
};
