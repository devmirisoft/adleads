import 'server-only';
import { config } from '../config';
import { fakeWhatsApp } from './fake';
import { liveWhatsApp } from './live';
import type { WhatsAppClient } from './types';

// Only @/modules/messaging send.ts may import this (it checks the 24 h window and logs to `messages`).
export const whatsapp: WhatsAppClient =
  config.INTEGRATIONS_MODE === 'live' ? liveWhatsApp : fakeWhatsApp;

export { WhatsAppLimitError, type Button, type ListRow, type SendResult } from './types';
