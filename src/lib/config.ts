import 'server-only';
import { z } from 'zod';

// The only place that reads process.env. Parsed once at boot; a bad env fails fast with the key names.
const optional = z.string().min(1).optional();

const LIVE_ONLY = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
] as const;

const WA_LIVE_ONLY = ['WA_PHONE_NUMBER_ID', 'WA_BUSINESS_ACCOUNT_ID', 'WA_ACCESS_TOKEN'] as const;

const PUSHER_KEYS = ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET', 'PUSHER_CLUSTER'] as const;

const schema = z
  .object({
    DATABASE_URL: z.url(),
    NEXTAUTH_SECRET: z.string().min(32, 'use `openssl rand -base64 32`'),
    NEXTAUTH_URL: z.url().optional(),

    INTEGRATIONS_MODE: z.enum(['fake', 'live']).default('fake'),
    // Overrides INTEGRATIONS_MODE for WhatsApp only.
    WA_MODE: z.enum(['fake', 'live']).optional(),
    // Webhook/cron secrets are needed in fake mode too (dev simulators sign with them).
    WA_APP_SECRET: z.string().min(1),
    WA_VERIFY_TOKEN: z.string().min(1),
    RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
    CRON_SECRET: z.string().min(16),
    // API credentials: only required when talking to the real services.
    WA_PHONE_NUMBER_ID: optional,
    WA_BUSINESS_ACCOUNT_ID: optional,
    WA_ACCESS_TOKEN: optional,
    RAZORPAY_KEY_ID: optional,
    RAZORPAY_KEY_SECRET: optional,
    ZOOM_ACCOUNT_ID: optional,
    ZOOM_CLIENT_ID: optional,
    ZOOM_CLIENT_SECRET: optional,

    // Push chat updates to staff browsers. Off: the chat thread polls instead.
    REALTIME_MODE: z.enum(['off', 'pusher']).default('off'),
    PUSHER_APP_ID: optional,
    PUSHER_KEY: optional,
    PUSHER_SECRET: optional,
    PUSHER_CLUSTER: optional,

    APP_TIMEZONE: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.REALTIME_MODE === 'pusher') {
      for (const key of PUSHER_KEYS) {
        if (!env[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'required when REALTIME_MODE=pusher',
          });
      }
    }
    if ((env.WA_MODE ?? env.INTEGRATIONS_MODE) === 'live') {
      for (const key of WA_LIVE_ONLY) {
        if (!env[key])
          ctx.addIssue({ code: 'custom', path: [key], message: 'required when WA is live' });
      }
    }
    if (env.INTEGRATIONS_MODE !== 'live') return;
    for (const key of LIVE_ONLY) {
      if (!env[key])
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'required when INTEGRATIONS_MODE=live',
        });
    }
  });

// `KEY=` (blank, as copied from .env.example) counts as unset.
const parsed = schema.safeParse(
  Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')),
);
if (!parsed.success) {
  // Key names and reasons only — never echo values.
  const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment (see .env.example):\n${problems}`);
}

export const config = parsed.data;
export type Config = typeof config;

export function isWhatsAppLive(): boolean {
  return (config.WA_MODE ?? config.INTEGRATIONS_MODE) === 'live';
}

/** Real WhatsApp but fake Zoom/Razorpay: their links would reach real people, so nothing may send them. */
export function linksAreFake(): boolean {
  return isWhatsAppLive() && config.INTEGRATIONS_MODE !== 'live';
}
