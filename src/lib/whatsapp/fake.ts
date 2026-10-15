import { randomUUID } from 'node:crypto';
import { checkButtons, checkList, checkTemplate, checkText, type WhatsAppClient } from './types';

// No network: enforces the real limits and hands back a message id.
// send.ts logs every message to the DB, which is what /dev/whatsapp renders.
const sent = () => Promise.resolve({ waMessageId: `wamid.fake.${randomUUID()}` });

export const fakeWhatsApp: WhatsAppClient = {
  async sendText(_to, text) {
    checkText(text);
    return sent();
  },
  async sendButtons(_to, msg) {
    checkButtons(msg);
    return sent();
  },
  async sendList(_to, msg) {
    checkList(msg);
    return sent();
  },
  async sendTemplate(_to, name, lang) {
    checkTemplate(name, lang);
    return sent();
  },
};
