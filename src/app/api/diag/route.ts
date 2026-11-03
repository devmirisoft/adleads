// TEMPORARY: webhook hang diagnostics. Delete this file and the `api/diag` entry in src/proxy.ts.
import { setTimeout as sleep } from 'node:timers/promises';
import { connection, type NextRequest } from 'next/server';
import { db } from '@/lib/db';

const ENV_KEYS = [
  'DATABASE_URL',
  'WA_APP_SECRET',
  'WA_VERIFY_TOKEN',
  'WA_TOKEN',
  'WA_PHONE_ID',
  'WA_WABA_ID',
  // The names src/lib/config.ts actually reads for the three above.
  'WA_ACCESS_TOKEN',
  'WA_PHONE_NUMBER_ID',
  'WA_BUSINESS_ACCOUNT_ID',
];
const STEP_LIMIT_MS = 15000;

function parseDatabaseUrl() {
  try {
    return new URL(process.env.DATABASE_URL ?? '');
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  await connection();
  const key = process.env.DIAG_KEY;
  if (!key || req.headers.get('x-diag-key') !== key) return new Response(null, { status: 404 });

  const url = parseDatabaseUrl();
  const mask = (text?: string) =>
    [url?.username, url?.password].reduce(
      (out, secret) => (secret ? out?.replaceAll(secret, '***') : out),
      text,
    );

  // A step that never answers is reported as a timeout: this route must not hang like the webhook.
  async function step<T>(run: () => Promise<T>) {
    const startedAt = Date.now();
    const limit = sleep(STEP_LIMIT_MS, undefined, { ref: false }).then(() => {
      throw new Error(`No answer after ${STEP_LIMIT_MS} ms`);
    });
    try {
      const result = await Promise.race([run(), limit]);
      return { ok: true, ms: Date.now() - startedAt, result };
    } catch (e) {
      const { name, message, code } = e as { name?: string; message?: string; code?: unknown };
      return {
        ok: false,
        ms: Date.now() - startedAt,
        error: { name, code, message: mask(message)?.slice(-300) },
      };
    }
  }

  return Response.json({
    region: process.env.VERCEL_REGION ?? null,
    uptimeS: Math.round(process.uptime()),
    env: Object.fromEntries(ENV_KEYS.map((k) => [k, Boolean(process.env[k])])),
    database: url && {
      host: url.hostname,
      name: url.pathname.slice(1),
      sslmode: url.searchParams.get('sslmode'),
    },
    select1: await step(async () => {
      await db.$queryRaw`SELECT 1`;
    }),
    transaction: await step(() =>
      db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1`;
          await tx.$queryRaw`SELECT 1`;
        },
        { maxWait: 5000, timeout: 10000 },
      ),
    ),
    webhookEventsTableExists: await step(async () => {
      const rows = await db.$queryRaw<
        { name: string | null }[]
      >`SELECT to_regclass('public.webhook_events')::text AS name`;
      return rows[0]?.name !== null;
    }),
  });
}
