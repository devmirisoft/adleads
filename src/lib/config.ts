import 'server-only';
import { z } from 'zod';

// The only place that reads process.env. Parsed once at boot; a bad env fails fast with the key names.
const optional = z.string().min(1).optional();

const LIVE_ONLY = [
  'WA_PHONE_NUMBER_ID',
  'WA_BUSINESS_ACCOUNT_ID',
  'WA_ACCESS_TOKEN',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
] as const;

const schema = z
  .object({
    DATABASE_URL: z.url(),
    NEXTAUTH_SECRET: z.string().min(32, 'use `openssl rand -base64 32`'),
    NEXTAUTH_URL: z.url().optional(),

    INTEGRATIONS_MODE: z.enum(['fake', 'live']).default('fake'),
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

    APP_TIMEZONE: z.literal('Asia/Kolkata').default('Asia/Kolkata'),
    SEED_ADMIN_EMAIL: z.email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((env, ctx) => {
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
